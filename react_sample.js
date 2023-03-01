import React, { useEffect, useState } from "react";
import {
  getDocs,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { auth, db, storage } from "../firebase-config";
import { useParams } from "react-router-dom";
import { ref, uploadBytes, listAll, getDownloadURL } from "firebase/storage";
import { v4 } from "uuid";
import { lookupUser, isAdmin } from "./User";

// Passing in Variable 'isAuth' means that the user is logged in
function Teams({ isAuth }) {
  // const Teams Variables
  const [teamLists, setTeamList] = useState([]);
  const [playerList, setPlayerList] = useState([]);
  const [descriptionList, setDescriptionList] = useState([]);
  const teamsCollectionRef = collection(db, "teams");
  const [playerNameS, setPlayerNameS] = useState("");
  const [playerDescriptS, setPlayerDescriptS] = useState("");
  const [imageList, setImageList] = useState([]);
  const imageListRef = ref(storage, "images/");
  const [imageUpload, setImageUpload] = useState(null);
  const [pictureList, setPictureList] = useState([]);
  const [show, setShow] = useState("");
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  // Delete Post function if users id equals the id of whomever created post 
  const deletePost = async (id) => {
    const postDoc = doc(db, "teams", id);
    await deleteDoc(postDoc);
    window.location.reload();
  };

  // html Modal code for when click on a players details
  const Modal = props => {
    if (props.show === "") {
      return null
    }
    return (
      <div id="playerModal" className="postTitleBox1">
        <div className="modal1content" onClick={ e => e.stopPropagation()}>
          <div>
              <ol>
                {(playerList, descriptionList).map((x,x1) => {
                  if (playerList[x1] == props.show) {console.log('modal for ' + props.show); 
                  return <div className="post1">
                    <div className="playerName">
                      <li>
                      {playerList[x1]}
                      </li>
                    </div>
                    <div className="inputGz">
                      <img width="100px" src={pictureList[x1]}/>
                    </div> 
                    <div className="modal1Footer">
                      <button onClick={props.onClose} className="button">Close</button>
                    </div>   
                  </div>
                }})}
              </ol>
            </div>
        </div> 
      </div>
    )
  }
  
  useEffect(() => {
    console.log("Playerlist changed to: ", playerList, playerList.length);
    console.log("Playerlist changed to: ", playerList[0]);
    playerList.forEach(function (entry) {
      console.log("AAA ", entry);
    });
  }, [playerList]);

  // Gets info that is stored in Firebase Database 
  useEffect(() => {
    console.log("Teams page mounted");
    const getTeams = async () => {
      const data = await getDocs(teamsCollectionRef);
      setTeamList(data.docs.map((doc) => ({ ...doc.data(), id: doc.id })));
    };

    getTeams();
    GetAllPlayers(teamname);
    GetAllDescriptions(teamname);
    GetAllPictures(teamname);
  }, []);

  useEffect(() => {
    console.log("Render?");
  });

  // Gets images saved in firebase images 
  useEffect(() => {
    listAll(imageListRef).then((response) => {
      response.items.forEach((item) => {
        getDownloadURL(item).then((url) => {
          setImageList((prev) => [...prev, url]);
        });
      });
    });
  }, []);

  const { teamname } = useParams();
  console.log("Showing page for " + teamname); // teamname = "legends1"

  // Create Player function that allows to save player names/descriptions on a specific team
  async function createPlayers(
    teamName,
    playerName,
    playerDesc,
    ) {
    teamName = teamname;
    playerName = playerNameS;
    playerDesc = playerDescriptS;
    console.log("create a new player on teamname=" + teamName);
    const querySnapshot = await getDocs(collection(db, "teams"));
    let tn = [];

    querySnapshot.forEach((doc) => {
      tn.push(doc.data().teamName);
      if (doc.data().teamName === teamName) {
        var playerNames = undefined;
        try {
          playerNames = doc.data().Players.Names;
        } catch (err) {}
        if (playerNames === undefined) playerNames = [];
        playerNames.push(playerName);

        var playerDescs = undefined;
        try {
          playerDescs = doc.data().Players.Descriptions;
        } catch (err) {}
        if (playerDescs === undefined) playerDescs = [];
        playerDescs.push(playerDesc);

        var image2Upload = undefined;
        try {
          image2Upload = doc.data().Players.Pictures;
        } catch (err) {}

        if (image2Upload === undefined) image2Upload = [];

        console.log("imageupl: ", imageUpload);

        if (imageUpload == null) return;
        const imageRef = ref(storage, `images/${imageUpload.name + v4()}`);
        uploadBytes(imageRef, imageUpload).then((snapshot) => {
          alert("Image Uploaded");
          getDownloadURL(snapshot.ref).then((url) => {
            setImageList((prev) => [...prev, url]);
            image2Upload.push(url);

            updateDoc(doc.ref, {
              Players: {
                Descriptions: playerDescs,
                Names: playerNames,
                Pictures: image2Upload,
              },
            });
          });
        });
      }
    });
    return tn;
  }

  // Gets Player names from Firebase
  function getPlayersFromDatabase(tn2find) {
    const tempDoc = [];
    const teamsCollectionRef = collection(db, "teams");
    let tn = [];

    const getPlayersFromDB2 = async () => {
      const querySnapshot = await getDocs(collection(db, "teams"));
      let tnx = [];

      querySnapshot.forEach((doc) => {
        if (doc.data().teamName === tn2find) {
          console.log("GPFDB: ", doc.id, " => ", doc.data().Players.Names);
          tnx = doc.data().Players.Names;
          setPlayerList((existItems) => {
            return tnx;
          });
        }
      });
      return Promise.resolve(tnx);
    };

    tn = getPlayersFromDB2();
    console.log("getPlayersFromDatabase returns ", tn);

    return tn;
  }

  function GetAllPlayers(teamName) {
    console.log("Getting players for ", teamName);
    const playerList = getPlayersFromDatabase(teamName);
    let f = [];

    playerList.then((x) => {
      f.push(x);
    });
    console.log("GetAllPlayers Returns ", f[0]);
    setPlayerList((existItems) => {
      return f;
    });

    return f;
  }

  // Gets Descriptions from Firebase
  function getDescriptionsFromDatabase(tn2find1) {
    const tempDoc = [];
    const postsCollectionRef = collection(db, "teams");
    let tn1 = [];

    const getDescriptionsFromDB2 = async () => {
      const querySnapshot = await getDocs(collection(db, "teams"));
      let tnx1 = [];

      querySnapshot.forEach((doc) => {
        if (doc.data().teamName === tn2find1) {
          console.log(
            "GPFDB: ",
            doc.id,
            " => ",
            doc.data().Players.Descriptions
          );
          tnx1 = doc.data().Players.Descriptions;
          setDescriptionList((existItems) => {
            return tnx1;
          });
        }
      });
      return Promise.resolve(tnx1);
    };

    tn1 = getDescriptionsFromDB2();
    console.log("getPlayersFromDatabase returns ", tn1);

    return tn1;
  }

  function GetAllDescriptions(teamName) {
    console.log("Getting descriptions for ", teamName);
    const descriptionList = getDescriptionsFromDatabase(teamName);
    let f1 = [];

    descriptionList.then((x1) => {
      f1.push(x1);
    });
    console.log("GetAllDescriptions Returns ", f1[0]);
    setDescriptionList((existItems) => {
      return f1;
    });

    return f1;
  }

  // Gets Pictures names from Firebase
  function getPicturesFromDatabase(tn2find) {
    let tn = [];

    const getPicturesFromDB2 = async () => {
      const querySnapshot = await getDocs(collection(db, "teams"));
      let tnx = [];

      querySnapshot.forEach((doc) => {
        if (doc.data().teamName === tn2find) {
          console.log("GPFDB: ", doc.id, " => ", doc.data().Players.Pictures);
          tnx = doc.data().Players.Pictures;
          setPictureList((existItems) => {
            return tnx;
          });
        }
      });
      return Promise.resolve(tnx);
    };

    tn = getPicturesFromDB2();
    console.log("getPicturesFromDatabase returns ", tn);

    return tn;
  }

  function GetAllPictures(teamName) {
    console.log("Getting descriptions for ", teamName);
    const pictureList = getPicturesFromDatabase(teamName);
    let f1 = [];

    pictureList.then((x2) => {
      f1.push(x2);
    });
    console.log("GetAllDescriptions Returns ", f1[0]);
    setPictureList((existItems) => {
      return f1;
    });

    return f1;
  }

  // JS code to substitute in HTML to only display create properties if user is an Admin
  let descriptionbox = "";
  if (auth.currentUser && isAdmin(auth.currentUser.uid)) {
    descriptionbox =  <div className="TeamsCreatePlayerPage">
    <div className="cpContainer">
      <h1>Create A Player</h1>
      <label> Current Team {teamname}</label>

      <div className="inputGp">
        <label> Player Name:</label>
        <input
          placeholder="Player Name..."
          onChange={(event) => {
            setPlayerNameS(event.target.value);
          }}
        />
      </div>
      <div className="inputGp">
        <label> Player Description:</label>
        <textarea
          placeholder="Player Description..."
          onChange={(event) => {
            setPlayerDescriptS(event.target.value);
          }}
        />
      </div>
      {/*Picutre Post Code Start*/}
      <div className="selectPic">
        <input
          type="file"
          onChange={(event) => {
            setImageUpload(event.target.files[0]);
          }}
        />
      </div>

      {/*Picutre Post Code Ends*/}
      <button onClick={createPlayers}> Create Player</button>
    </div>
  </div>
  }

  // HTML code displayed on Teams Page 
  return (
    <div className="teamPage">
      <div className="bigBoxTitleBox" onClick={ e => e.stopPropagation()}>
        <div className="postTitleBox">
            <div>
              <ol>
                {(playerList, descriptionList).map((x,x1) => {
                  return <div className="post">
                    <div className="playerName">
                      <li>
                      {playerList[x1]}
                      </li>
                    </div>
                    <div className="inputGz">
                      <img width="100px" src={pictureList[x1]}/>
                    </div> 
                    <div className="modal1">
                      <button onClick={() => setShow(playerList[x1])}> Player Details </button>
                    </div>

                    {/*Delete Code Start */}
                    <div className="deletePostTeams">
                      {isAuth && x1.author.id === auth.currentUser?.uid && (
                        <button
                          onClick={() => {
                            deletePost(x1.id);
                          }}
                        >
                          {" "}
                          &#128465;
                        </button>
                      )}
                    </div>
                    {/*Delete Code End */}

                  </div>
                })}
              </ol>
            </div>
        </div>
      </div>
      <Modal onClose={
          () => {
            console.log("unblurring..");
            var a = document.getElementById("playerModal");
            if (a) {
              console.log("hiding bg " + a);
              a.style.display = "none";
            } else {
              console.log("cant find element?");
            }          
          }
        } show={show} />
      
      {auth.currentUser && isAdmin(auth.currentUser.uid) ? "yes" : "no"} 
      {descriptionbox}
    </div>
  );
}

export default Teams;