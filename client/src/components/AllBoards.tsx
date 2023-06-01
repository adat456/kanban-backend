import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
// import { io } from "socket.io-client";

import { UserContext, userInterface, ModeContext, UserStatusContext, BoardsContext, CurBoardIdContext, boardData } from "../Context";
import { handleDisplayMsg, fetchCatch } from "./helpers";
import Sidebar from "./boardComponents/Sidebar";
import EditBoard from "./crudComponents/EditBoard";
import Board from "./boardComponents/Board";

const AllBoards: React.FC = function({}) {
    // context values
    const [ boardsData, setBoardsData ] = useState<boardData[] | null>(null);
    const [ curBoardId, setCurBoardId ] = useState("");
    const [ user, setUser ] = useState<userInterface | null>(null);
    const [ userStatus, setUserStatus ] = useState("");
    const [ mode, setMode ] = useState("light");
    // local state
    const [ curBoard, setCurBoard ] = useState<boardData | null>(null);
    const [ loading, setLoading ] = useState(true);
    const [ sidebarVis, setSidebarVis ] = useState(window.innerWidth > 500 ? true : false);
    const [ editBoardVis, setEditBoardVis ] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();

    const mainRef = useRef<HTMLElement | null>(null);
    const headerLogoRef = useRef<SVGSVGElement | null>(null);
    const sidebarBackdropRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        async function pullBoardsData() {
            try {
                const req = await fetch("/api/read-all", { credentials: "include" });
                // may be data for all boards
                const res = await req.json();
                if (req.ok) {
                    setBoardsData(res);
                    setLoading(false);
                    handleDisplayMsg(true, "Boards data retrieved.");
                } else {
                    throw new Error(res);
                };
            } catch (err) {
                fetchCatch(err, navigate);
            };
        };    
        
        async function getUser() {
            try {
                const req = await fetch("/api/user-info", { credentials: "include" });
                // may be user data
                const res = await req.json();
                if (req.ok) {
                    setUser(res);

                    // if able to pull a user, check if there is a dark mode preference in localstorage; if so, set it, if not, default will be light mode
                    const mode = localStorage.getItem(res._id);
                    if (mode) setMode(mode);
                } else {
                    throw new Error(res);
                };
            } catch(err) {
                fetchCatch(err, navigate);
            };
        };

        // retrieves useLocation state (passed in by Signup and Login components); sets boardsData to an empty array (not null) because Sidebar will need to map over it once loading is set to false
        if (location.state.newUser) {
            getUser();
            setBoardsData([]);
            setLoading(false);
        };

        // if not a new user and boardsData is null, call the async fetch data fx
        if (!location.state.newUser && !boardsData) {
            getUser();
            pullBoardsData();
            setLoading(false);
        };  
    }, []);

    useEffect(() => {
        const app = document.querySelector("#app");
        if (mode === "light") app?.classList.remove("dark");
        if (mode === "dark") app?.classList.add("dark");
    }, [mode]);

    useEffect(() => {
        boardsData?.forEach(board => {
            if (board._id === curBoardId) {
                setCurBoard(board);
                // set the current user every time the current board Id changes
                if (board.creator.userId === user?._id) {
                    setUserStatus("Creator");
                } else if (board.contributors) {
                    const contributorProfile = board.contributors.find(contributor => contributor.userId === user?._id);
                    if (contributorProfile) setUserStatus(contributorProfile.userStatus);
                };
            };
        });
    }, [curBoardId, boardsData]);

    useEffect(() => {
        if (sidebarVis) {
            mainRef?.current?.classList.remove("sidebar-hidden");
            headerLogoRef?.current?.classList.add("hidden-header-logo");
            sidebarBackdropRef?.current?.classList.add("visible");
        } else {
            mainRef?.current?.classList.add("sidebar-hidden");
            headerLogoRef?.current?.classList.remove("hidden-header-logo");
            sidebarBackdropRef?.current?.classList.remove("visible");
        };
    }, [sidebarVis]);

    useEffect(() => {
        if (editBoardVis) {
            const editBoardModal: HTMLDialogElement | null = document.querySelector("#edit-board-modal");
            editBoardModal?.showModal();
        };
    }, [editBoardVis]);

    return (  
        <div id="app">
            <BoardsContext.Provider value={{boardsData, setBoardsData}}>
                <CurBoardIdContext.Provider value={{curBoardId, setCurBoardId}}>
                    <UserContext.Provider value={user}>
                        <UserStatusContext.Provider value={userStatus}>
                            <ModeContext.Provider value={mode}>
                                {sidebarVis ?
                                    <Sidebar loading={loading} setMode={setMode} setSidebarVis={setSidebarVis} setUser={setUser} /> :
                                    <button onClick={() => setSidebarVis(true)} className="sidebar-vis-btn" title="Show sidebar">
                                        <svg aria-hidden="true" focusable="false" viewBox="0 0 16 11" xmlns="http://www.w3.org/2000/svg"><path d="M15.815 4.434A9.055 9.055 0 0 0 8 0 9.055 9.055 0 0 0 .185 4.434a1.333 1.333 0 0 0 0 1.354A9.055 9.055 0 0 0 8 10.222c3.33 0 6.25-1.777 7.815-4.434a1.333 1.333 0 0 0 0-1.354ZM8 8.89A3.776 3.776 0 0 1 4.222 5.11 3.776 3.776 0 0 1 8 1.333a3.776 3.776 0 0 1 3.778 3.778A3.776 3.776 0 0 1 8 8.89Zm2.889-3.778a2.889 2.889 0 1 1-5.438-1.36 1.19 1.19 0 1 0 1.19-1.189H6.64a2.889 2.889 0 0 1 4.25 2.549Z" fill="#FFF"/></svg>
                                        <span className="sr-only">Show sidebar</span>
                                    </button>
                                }
                                {!curBoardId ?
                                    <div className="all-boards">
                                        <header>
                                            <svg ref={headerLogoRef} className="header-logo" viewBox="0 0 24 25" xmlns="http://www.w3.org/2000/svg" aria-describedby="all-boards-logo" aria-hidden="true" role="img"><title id="all-boards-logo">Minimalist Kanban logo</title><g fill="#635FC7" fillRule="evenodd"><rect width="6" height="25" rx="2"/><rect opacity=".75" x="9" width="6" height="25" rx="2"/><rect opacity=".5" x="18" width="6" height="25" rx="2"/></g></svg>
                                            <h1 />
                                            {sidebarVis ?
                                                <button className="dropdown-sidebar-btn open" type="button" onClick={() => setSidebarVis(false)}>
                                                    <svg className="nav-arrow" viewBox="0 0 10 7" xmlns="http://www.w3.org/2000/svg"><path stroke="#635FC7" strokeWidth="2" fill="none" d="M9 6 5 2 1 6"/></svg>
                                                </button> :
                                                <button className="dropdown-sidebar-btn closed" type="button" onClick={() => setSidebarVis(true)}>
                                                    <svg className="nav-arrow" viewBox="0 0 10 7" xmlns="http://www.w3.org/2000/svg"><path stroke="#635FC7" strokeWidth="2" fill="none" d="m1 1 4 4 4-4"/></svg>    
                                                </button>
                                            }
                                        </header>
                                        <main ref={mainRef} id="no-brd-chosen">
                                            <p>Please choose or create a board to get started.</p>
                                        </main>
                                    </div>  : 
                                    <div className="all-boards">
                                        <header>
                                            <svg ref={headerLogoRef} className="header-logo" viewBox="0 0 24 25" xmlns="http://www.w3.org/2000/svg"><g fill="#635FC7" fillRule="evenodd"><rect width="6" height="25" rx="2"/><rect opacity=".75" x="9" width="6" height="25" rx="2"/><rect opacity=".5" x="18" width="6" height="25" rx="2"/></g></svg>
                                            {(userStatus === "Creator" || userStatus === "Co-creator") ? 
                                                <>
                                                    <h1>{curBoard?.name}</h1>
                                                    <button type="button" className="edit-brd-btn" onClick={() => setEditBoardVis(true)} title="Edit board">
                                                        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.0651 7.39423L7.09967 20.4114C6.72438 20.7882 6.21446 21 5.68265 21H4.00383C3.44943 21 3 20.5466 3 19.9922V18.2987C3 17.7696 3.20962 17.2621 3.58297 16.8873L16.5517 3.86681C19.5632 1.34721 22.5747 4.87462 20.0651 7.39423Z"  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                        <span className="sr-only">Edit board</span>
                                                    </button>
                                                </> : <h1>{curBoard?.name}</h1>
                                            }                                
                                            {sidebarVis ?
                                                <button className="dropdown-sidebar-btn open" type="button" onClick={() => setSidebarVis(false)} title="Close navigation">
                                                    <svg aria-hidden="true" focusable="false" className="nav-arrow" viewBox="0 0 10 7" xmlns="http://www.w3.org/2000/svg"><path stroke="#635FC7" strokeWidth="2" fill="none" d="M9 6 5 2 1 6"/></svg>
                                                    <span className="sr-only">Close navigation</span>
                                                </button> :
                                                <button className="dropdown-sidebar-btn closed" type="button" onClick={() => setSidebarVis(true)} title="Expand navigation">
                                                    <svg aria-hidden="true" focusable="false" className="nav-arrow" viewBox="0 0 10 7" xmlns="http://www.w3.org/2000/svg"><path stroke="#635FC7" strokeWidth="2" fill="none" d="m1 1 4 4 4-4"/></svg> 
                                                    <span className="sr-only">Expand navigation</span>   
                                                </button>
                                            }
                                            {editBoardVis ? <EditBoard setEditBoardVis={setEditBoardVis} /> : null }
                                        </header>
                                        <main ref={mainRef}>
                                            <Board />
                                        </main>
                                        <div ref={sidebarBackdropRef} className="sidebar-backdrop" onClick={() => setSidebarVis(false)}></div>
                                    </div>
                                }
                            </ModeContext.Provider>
                        </UserStatusContext.Provider>
                    </UserContext.Provider>
                </CurBoardIdContext.Provider>
            </BoardsContext.Provider>
        </div>   
    );
};

export default AllBoards;