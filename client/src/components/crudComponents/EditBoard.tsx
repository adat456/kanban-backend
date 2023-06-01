import React, { useState, useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ContributorModal from "./ContributorModal";
import { BoardsContext, CurBoardIdContext, contributorType } from "../../Context";
import { handleDisplayMsg, fetchCatch } from "../helpers";
import Fields from "./Fields";

interface Prop {
    setEditBoardVis: React.Dispatch<React.SetStateAction<boolean>>
};

const EditBoard: React.FC<Prop> = function({ setEditBoardVis }) {
    const { boardsData, setBoardsData } = useContext(BoardsContext);
    const { curBoardId, setCurBoardId } = useContext(CurBoardIdContext);
    const curBoard = boardsData?.find(board => (board._id === curBoardId));

    const [ boardName, setBoardName ] = useState(curBoard?.name);
    const [ errMsg, setErrMsg ] = useState("");
    const [ colValues, setColValues ] = useState(curBoard?.columns.map(col => { return {id: col._id, value: col.name}}));
    const [ colsTBD, setColsTBD ] = useState([]);
    // for new columns
    const counterRef = useRef(curBoard?.columns.length);

    // ContributorModal state
    const [ contributorModal, setContributorModal ]  = useState(false);
    const [ contributorsLifted, setContributorsLifted ] = useState<contributorType[] | undefined>(curBoard?.contributors);
    const [ contributorCounter, setContributorCounter ] = useState(0);

    const navigate = useNavigate();

    function handleNamePopup(userId: string | undefined) {
        const contributorNamePopup = document.querySelector(`#assignee-name-${userId}`);
        contributorNamePopup?.classList.toggle("hidden");
    };
    // sorts contributors from co-creator to member to viewer
    curBoard?.contributors.sort((a, b) => {
        if (a.userStatus > b.userStatus) return 1;
        if (a.userStatus < b.userStatus) return -1
    });
    function generateInitials(name: string | undefined) {
        let nameArr;
        if (typeof name === "string") nameArr = name.split(" ");
        const initials = nameArr?.map(name => name.slice(0, 1)).join("");
        return initials;
    };
    const contributorIcons = curBoard?.contributors.map(contributor => {
        return (
            <li tabIndex={0} key={contributor.userId} className="assignee-icon" onMouseEnter={() => handleNamePopup(contributor.userId)} onFocus={() => handleNamePopup(contributor.userId)} onMouseLeave={() => handleNamePopup(contributor.userId)} onBlur={() => handleNamePopup(contributor.userId)}>
                <p>{generateInitials(contributor.userName)}</p>
                <div className="assignee-full-name hidden" id={`assignee-name-${contributor.userId}`}>
                    <div className="pointer"></div>
                    <p>{`${contributor.userName} - ${contributor.userStatus}`}</p>
                </div>
            </li>
        );
    });

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
                if (board._id !== curBoardId && board.name.trim().toLowerCase() === input.value.trim().toLowerCase()) valid = false;
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

    function handleEditBoardModal() {
        const editBoardModal: HTMLDialogElement | null = document.querySelector("#edit-board-modal");
        editBoardModal?.close();

        setEditBoardVis(false);
    };

    function handleDeleteBoardModal(action: string) {
        const deleteBoardModal: HTMLDialogElement | null = document.querySelector("#delete-board-modal");
        if (action === "show") {
            const editBoardModal: HTMLDialogElement | null = document.querySelector("#edit-board-modal");
            editBoardModal?.close();
            deleteBoardModal?.showModal();
        };
        if (action === "close") {
            deleteBoardModal?.close();
            setEditBoardVis(false);
        };
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!errMsg) { 
            let columns: {name: string, id: string}[] = [];
            colValues?.forEach(col => {
                // filters out any column fields that were left empty and formats info in the object
                if (col.value) columns.push({ name: col.value, id: col.id });
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
                    boardId: curBoardId,
                    // sends both columns that need to be added/updated and columns that need to be deleted
                    columns: [...columns, ...colsTBD],
                    contributors
                }),
                // indicates whether user should receive AND send cookies
                credentials: "include"
            };
            
            try {
                const req = await fetch("/api/update-board", reqOptions);
                // either the updated board or an error message
                const res = await req.json();
                if (req.ok) {
                    handleDisplayMsg(true, "Board updated.");
    
                    // update context as well
                    const updatedBoardsData = boardsData?.map(board => {
                        if (board._id === res._id) {
                            return res;
                        } else {
                            return board;
                        };
                    });
                    if (updatedBoardsData) setBoardsData(updatedBoardsData);

                    handleEditBoardModal();
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

    async function handleDelete() {
        try {
            const req = await fetch(`/api/delete-board/${curBoardId}`, { method: "DELETE", credentials: "include" });
            // either a success or error message
            const res = await req.json();
            if (req.ok) {
                handleDisplayMsg(true, res);
    
                // update context as well
                const filteredBoardsData = boardsData?.filter(board => {
                    return (board._id !== curBoardId);
                });
                if (filteredBoardsData) setBoardsData(filteredBoardsData);         
                setCurBoardId("");

                handleDeleteBoardModal("close");
            } else {
                throw new Error(res);
            };
        } catch(err) {
            fetchCatch(err, navigate);
        };
    };

    return (
        <div>
            <dialog className="form-modal" id="edit-board-modal"> 
                <form method="POST" className="edit-brd-form" onSubmit={handleSubmit} noValidate>
                    <div className="edit-board-header">
                        <h2>Edit Board</h2>
                        <button type="button" onClick={() => setContributorModal(true)} title="Edit contributors">
                            <svg aria-hidden="true" focusable="false" className="add" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 8V16M8 12H16M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            <span className="sr-only">Edit contributors</span>
                        </button>
                    </div>
                    <ul className="contributor-icons">
                        {/* board creator's icon */}
                        <li tabIndex={0} key={curBoard?.creator.userId} className="assignee-icon" onMouseEnter={() => handleNamePopup(curBoard?.creator.userId)} onFocus={() => handleNamePopup(curBoard?.creator.userId)} onMouseLeave={() => handleNamePopup(curBoard?.creator.userId)} onBlur={() => handleNamePopup(curBoard?.creator.userId)}>
                            <p>{generateInitials(curBoard?.creator.userName)}</p>
                            <div className="assignee-full-name hidden" id={`assignee-name-${curBoard?.creator.userId}`}>
                                <div className="pointer"></div>
                                <p>{`${curBoard?.creator.userName} - Creator`}</p>
                            </div>
                        </li>
                        {contributorIcons}
                    </ul>
                    <label htmlFor="boardName">Board Name</label>
                    <input type="text" id="boardName" defaultValue={curBoard?.name} onChange={handleChange} maxLength={20} required />
                    {errMsg ? <p className="err-msg">{errMsg}</p> : null}
                    {colValues ? <Fields type="col" values={colValues} setValues={setColValues} counterRef={counterRef} valuesTBD={colsTBD} setValuesTBD={setColsTBD} /> : null }
                    <button className="save-btn" type="submit">Save Changes</button>
                    <button className="delete-btn" type="button" onClick={() => handleDeleteBoardModal("show")}>Delete Board</button>
                    <button className="close-modal" type="button" onClick={handleEditBoardModal} title="Close modal">
                        <svg aria-hidden="true" focusable="false" viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg"><g fillRule="evenodd"><path d="m12.728 0 2.122 2.122L2.122 14.85 0 12.728z"/><path d="M0 2.122 2.122 0 14.85 12.728l-2.122 2.122z"/></g></svg>
                        <span className="sr-only">Close modal</span>
                    </button>
                </form>       
            </dialog>
            {contributorModal ? 
                <ContributorModal setContributorModal={setContributorModal} contributorsLifted={contributorsLifted} setContributorsLifted={setContributorsLifted} contributorCounter={contributorCounter} setContributorCounter={setContributorCounter} /> : null
            }
            <dialog className="delete-modal" id="delete-board-modal">
                <h2>Delete this board?</h2>
                <p>{`Are you sure you want to delete the '${curBoard?.name}' board? This action will remove all columns and tasks and cannot be reversed.`}</p>
                <div className="delete-btn-cluster">
                    <button type="button" className="delete-btn" onClick={handleDelete}>Delete</button>
                    <button type="button" className="cancel-btn" onClick={() => handleDeleteBoardModal("close")}>Cancel</button>
                </div>
            </dialog>
        </div>
    );
};

export default EditBoard;