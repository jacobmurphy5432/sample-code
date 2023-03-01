import mysql.connector
import json
from geopy.geocoders import Nominatim
import requests
import datetime 
import uuid
import config


headers = {
    'Content-Type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
    'access-control-allow-methods': 'OPTIONS,GET'
}

def first_day_of_this_year():
    """
    this function finds the first day of the current year for
    YTD queries

    :return: datetime object
    :rtype: datetime
    """
    todayDate = datetime.date.today()
    return todayDate.replace(day=1, month=1)

def dopost(api: str, data: dict) -> object:
    """
    helper function to POST to the API. raises if anything
    goes wrong.

    :param str api: the base of the api URI eg "version" "product/list" "product/get" etc
    :param dict data: the object to POST to the API endpoint
    :return: requests object
    """
    req = requests.post("{}/{}".format(config.base, api),
                        verify=False,
                        data=json.dumps(data),
                        headers=headers)
    try:
        rsp = req.json()
        return rsp
    except Exception as e:
        print(
            f"Failed to decode json {e}"
        )
        raise


def only_your_products(prodname: str, apikey: str) -> bool:  
    """
    Fetch the list of products assigned to the apikey and make sure that
    'prodname' is in that list. The api returns a list of product objects,
    and doesn't offer filtering, so we need to check each one. Most customers
    have only a few products, so this should be reasonably quick to do.

    :param str prodname: the product name (case sensitive)
    :param str apikey: the customers API key
    :return: true or false if the product is in the customers product list or not
    :rtype: bool
    """
    a = dopost("product/list", {'apikey': apikey})

    for p in a['product_list']:
        if prodname == p['make']:
            return True
    return False

def lambda_function(event: dict, context: object) -> dict:
    """
    AWS Lambda function called by apigateway. This function takes
    an apigateway event dictionary. we only need two things from the
    query string: the product name and the apikey. 

    For example, we might be called like https://example.com/runreport?productname=Black+Socks&apikey=1234
    """

    # extract and validate our API parameters: both are required
    product_name = None
    try:
        product_name = event['queryStringParameters']['product']
    except KeyError:
        print("no product name")
        return {'statusCode': 403, 'body': "product is required"}

    apikey = None
    try:
        apikey = event['queryStringParameters']['apikey']
    except KeyError:
        print("no apikey")
        return {'statusCode': 403, 'body': "apikey required"}


    try:
        if only_your_products(product_name, apikey) is False:
            # you do not have access to the report
            print(f"no access to {product_name}")
            return {'statusCode': 403, 'body': "no access to product"}

        cnx = mysql.connector.connect(host=config.DBHOST, user=config.USER, password=config.PASS, database=config.DBNAME)
        cursor = cnx.cursor(buffered=True)

        # we are going to fill in the city name from a geo lookup service. our
        # database only tracks latitude and longitude.
        locator = Nominatim(user_agent='psx/product-report-1.0', timeout=10, domain='172.31.70.192:8080', scheme='http')

        cache = {}

        city_state_rows = []
        orig_rows = []

        #           0                 1                   2                 3                 4                5
        query = ("""
        SELECT distinct(p.make), count(et.activity), year(et.created), month(et.created), ROUND(et.lat, 1), ROUND(et.lon, 1)
        FROM etaggedtag et, encodertags t, products p, companies c 
        WHERE 
        et.tag_id = t.id 
        and p.id = t.product_id 
        and c.id = p.company_id 
        and et.activity != "Created" 
        and et.lat != 0 and et.lon != 0 
        and et.created >= %s
        and p.make = %s
        GROUP BY p.make, YEAR(et.created), MONTH(et.created), ROUND(et.lat, 1), ROUND(et.lon, 1)
        ORDER BY MONTH(et.created), YEAR(et.created) DESC;""")

        cursor.execute(query, (first_day_of_this_year(), product_name, ))

        for row in cursor:
            lat = row[4]
            lon = row[5]

            coordinates = f"{lat}, {lon}"
            # if we already know the answer from Nominatim, don't ask them again.
            if coordinates in cache:
                location = cache[coordinates]
            else:
                location = locator.reverse(coordinates)
                cache[coordinates] = location

            # pull the city name from the Nominatim response
            if 'city' in location.raw['address']:
                city = location.raw['address']['city']
            elif 'municipality' in location.raw['address']:
                city = location.raw['address']['municipality']
            elif 'county' in location.raw['address']:
                city = location.raw['address']['county']
            else:
                city = 'unknown'

            # also pull the state name
            state = location.raw['address']['state']

            # keep a list of city/states that matches up the rows returned from the
            # db
            city_state_rows.append((city, state))
            orig_rows.append(row)

        # return the db response and the list of city/states
        response = {'rows': orig_rows, 'cities': city_state_rows}

        return {
            'statusCode': 200,
            'body': json.dumps(response),
            'headers': headers
        }
        
    except Exception as e:
        logid = uuid.uuid4()
        print(f"{logid} problem: {e}")
        return {
            'statusCode': 500, 
            'body': 'a problem occurred. let us know to look into it. logid: {logid}',
            'headers': headers
        }
