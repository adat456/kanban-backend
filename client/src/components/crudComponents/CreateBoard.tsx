import React, { useState, useContext, useRef, useEffect } from "react";
// import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom"; 
import { BoardsContext, UserContext, contributorType } from "../../Context";
import { handleDisplayMsg, fetchCatch } from "../helpers";
import Fields from "./Fields";
import ContributorModal from "./ContributorModal";

interface Prop {
    setCreateBoardVis: React.Dispatch<React.SetStateAction<boolean>>
};

const CreateBoard: React.FC<Prop> = function ({ setCreateBoardVis }) {
    const [ boardName, setBoardName ] = useState("");
    const [ errMsg, setErrMsg ] = useState("Field required");
    const [ colValues, setColValues ] = useState([
        { id: "1", value: "" },
        { id: "2", value: "" },
    ]);

    // ContributorModal state
    const [ contributorModal, setContributorModal ]  = useState(false);
    const [ contributorsLifted, setContributorsLifted ] = useState<contributorType[] | null>(null);
    const [ contributorCounter, setContributorCounter ] = useState(0);

    const { boardsData, setBoardsData } = useContext(BoardsContext);
    const user = useContext(UserContext);
    const counterRef = useRef(3);

    const navigate = useNavigate();

    // const socket = io("http://localhost:5500", {
    //     withCredentials: true,
    // });

    useEffect(() => {
        if (contributorModal) {
            const modal: HTMLDialogElement | null = document.querySelector("#contributor-modal");
            modal?.showModal();
        };
    }, [contributorModal]);
    
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const input = e.target;

        // if there's an input at all 
        if (input.value !== "") { 
            // check that the board name is unique 
            let valid = true;
            boardsData?.forEach(board => {
                if (board.name.trim().toLowerCase() === input.value.trim().toLowerCase()) valid = false;
            }); 

            if (valid) {
                setErrMsg("");
                input.setCustomValidity("");
            } else {
                setErrMsg("Board name must be unique.");
                input.setCustomValidity("Board name must be unique.");
            };
        };
        
        // if there's no input, throw err
        if (input.value === "") {
            setErrMsg("Field required.");
            input.setCustomValidity("");
        };

        setBoardName(input.value);
    };

    function handleCreateBoardModal() {
        const createBoardModal: HTMLDialogElement | null = document.querySelector("#create-board-modal");
        createBoardModal?.close();
        
        setCreateBoardVis(false);
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!errMsg) {
            let columns: {name: string}[] = [];
            colValues.forEach(col => {
                if (col.value) columns.push({ name: col.value });
            });

            // cleaning up the contributorsLifted state, removing unnecessary key and alreadyAdded key-value pairs. if it is equal to null, there will be no contributors property at all in req.body
            const contributors = contributorsLifted?.map(contributor => {
                return {
                    userId: contributor.userId,
                    userName: contributor.userName,
                    userStatus: contributor.userStatus,
                };
            });

            const reqOptions: RequestInit = {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ 
                    name: boardName, 
                    creator: {
                        userName: user?.firstName + " " + user?.lastName,
                        userId: user?._id,
                    },
                    columns, 
                    contributors
                }),
                // indicates whether user should receive AND send cookies
                credentials: "include"
            };

            // socket.on("contributor-message", msg => console.log(msg));
            
            try {
                const req = await fetch("/api/create-board", reqOptions);
                const res = await req.json();

                if (req.ok) {
                    handleDisplayMsg(true, "Board created.");
                
                    setBoardsData([...boardsData, res]);

                    handleCreateBoardModal();
                } else {
                    throw new Error(res);
                };
            } catch(err) {
                fetchCatch(err, navigate);
            };
        } else {
            handleDisplayMsg(false, "Please fix errors before submitting.");
        };
    };
    
    return (
        <>
            <dialog className="form-modal" id="create-board-modal">
                <form method="POST" onSubmit={handleSubmit} noValidate>
                    <div className="create-board-header">
                        <h2>Add New Board</h2>
                        <button type="button" onClick={() => setContributorModal(true)} title="Add contributors">
                            <svg aria-hidden="true" focusable="false" className="add" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 8V16M8 12H16M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            <span className="sr-only">Add contributors</span>
                        </button>
                    </div>
                    <label htmlFor="boardName">Board Name *</label>
                    <input type="text" id="boardName" onChange={handleChange} maxLength={20} required />
                    {errMsg ? <p className="err-msg">{errMsg}</p> : null}
                    <Fields type="col" values={colValues} setValues={setColValues} counterRef={counterRef} />
                    <button type="submit" className="save-btn">Create New Board</button>
                </form>
                <button className="close-modal" type="button" onClick={handleCreateBoardModal} title="Close modal">
                    <svg aria-hidden="true" focusable="false" viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg"><g fillRule="evenodd"><path d="m12.728 0 2.122 2.122L2.122 14.85 0 12.728z"/><path d="M0 2.122 2.122 0 14.85 12.728l-2.122 2.122z"/></g></svg>
                    <span className="sr-only">Close modal</span>
                </button>
            </dialog>  
            {contributorModal ? <ContributorModal setContributorModal={setContributorModal} contributorsLifted={contributorsLifted} setContributorsLifted={setContributorsLifted} contributorCounter={contributorCounter} setContributorCounter={setContributorCounter} /> : null}
        </>    
    );
};

export default CreateBoard;