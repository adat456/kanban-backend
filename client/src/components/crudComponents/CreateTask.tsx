import React, { useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BoardsContext, CurBoardIdContext, columnData, UserContext } from "../../Context";
import { handleDisplayMsg, fetchCatch } from "../helpers";
import Fields from "./Fields";

interface Prop {
    curCol: string,
    columnsArr: columnData[],
    setCreateTaskVis: React.Dispatch<React.SetStateAction<boolean>>
};

interface assigneeInfo {
    userId: string,
    userName: string
};

const CreateTask: React.FC<Prop> = function({ curCol, columnsArr, setCreateTaskVis }) {
    const [ task, setTask ] = useState("");
    const [ errMsg, setErrMsg ] = useState("Field required.");
    const [ desc, setDesc ] = useState("");
    const [ subtaskValues, setSubtaskValues ] = useState([
        { id: "1", value: "" },
        { id: "2", value: "" },
    ]);
    const [ updatedColId, setUpdatedColId ] = useState(curCol);
    const [ assignees, setAssignees ] = useState<assigneeInfo[]>([]);
    
    const counterRef = useRef(3);
    const deadlineRef = useRef<HTMLInputElement | null>(null);

    const navigate = useNavigate();

    const { boardsData, setBoardsData } = useContext(BoardsContext);
    const { curBoardId } = useContext(CurBoardIdContext);
    const curBoard = boardsData?.find(board => board._id === curBoardId);
    const user = useContext(UserContext);

    const colOptions = columnsArr.map(col => {
        return (
            <option key={col._id} value={col._id}>{col.name}</option>
        );
    });

    curBoard?.contributors.sort((a, b) => {
        if (a.userStatus > b.userStatus) return 1;
        if (a.userStatus < b.userStatus) return -1
    });
    const assigneeOptions = curBoard?.contributors?.map(contributor => {
        return (
            <option key={contributor.userId} value={contributor.userId}>{`${contributor.userName} - ${contributor.userStatus}`}</option>
        );
    });

    const chosenAssignees = assignees?.map(assignee => {
        return (
            <button type="button" key={assignee.userId} className="chosen-assignee" onClick={() => handleRemoveAssignee(assignee.userId)}>
                <p>{`${assignee.userName}`}</p>
                <svg viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg"><g fillRule="evenodd"><path d="m12.728 0 2.122 2.122L2.122 14.85 0 12.728z"/><path d="M0 2.122 2.122 0 14.85 12.728l-2.122 2.122z"/></g></svg>
            </button>
        );
    });

    function handleAddAssignee(e: React.ChangeEvent<HTMLSelectElement>) {
        const userId = e.target.value;
        let userName;
        curBoard?.contributors.forEach(contributor => {
            if (contributor.userId === userId) userName = contributor.userName;
        });
        // if the user id does not match a user id in the contributors list, then it must be the creator's user id --> manually set name below
        if (!userName) userName = user?.firstName + " " + user?.lastName;
        if (!assignees.find(assignee => assignee.userId === userId)) {
            setAssignees([...assignees, {userId, userName}]);
        };
    };

    function handleRemoveAssignee(userId: string) {
        setAssignees(assignees.filter(assignee => assignee.userId !== userId));
    };

    function handleChange(e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) {
        const input = e.target;
        const field = e.target.getAttribute("id");

        if (field === "task") {
            // if there's an input at all 
            if (input.value !== "") { 
                // check that the task name is unique 
                let valid = true;
                curBoard?.columns.forEach(col => {
                    col.tasks.forEach(task => {
                        if (task.task.trim().toLowerCase() === input.value.trim().toLowerCase()) valid = false;
                    });
                }); 

                if (valid) {
                    setErrMsg("");
                    input.setCustomValidity("");
                } else {
                    setErrMsg("Task name must be unique.");
                    input.setCustomValidity("Task name must be unique.");
                };
            };
            
            // if there's no input, throw err
            if (input.value === "") {
                setErrMsg("Field required.");
                input.setCustomValidity("");
            };

            setTask(input.value);
        };

        if (field === "desc") setDesc(input.value);
    };

    function handleCreateTaskModal() {
        const createTaskModal: HTMLDialogElement | null = document.querySelector("#create-task-modal");
        createTaskModal?.close();
        
        setCreateTaskVis(false);
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!errMsg) {
            // get subtasks and format in arr
            let subtasks: {subtask: string, status: boolean}[] = [];      
            subtaskValues.forEach(subtask => {
                if (subtask.value) {
                    subtasks.push({
                        subtask: subtask.value,
                        status: false,
                    });
                };
            });

            // both dates formatted as a string "YYYY-MM-DD"
            const today = new Date().toISOString().slice(0, 10);

            const reqOptions: RequestInit = {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ 
                    boardId: curBoardId, 
                    columnId: updatedColId, 
                    task, 
                    desc, 
                    subtasks,
                    created: today,
                    deadline: deadlineRef?.current?.value,
                    assignees,
                    completed: false
                }),
                credentials: "include"
            };
            
            try {
                const req = await fetch("/api/create-task", reqOptions);
                // may be the updated board data
                const res = await req.json();
                if (req.ok) {
                    handleDisplayMsg(true, "Task created.");

                    // update context as well
                    const updatedBoardsData = boardsData?.map(board => {
                        if (board._id === res._id) {
                            return res;
                        } else {
                            return board;
                        };
                    });
                    if (updatedBoardsData) setBoardsData(updatedBoardsData);

                    handleCreateTaskModal();
                } else {
                    // client-generated error message
                    throw new Error(res);
                };
            } catch(err) {
                fetchCatch(err, navigate);
            };
            // close out window/modal
        } else {
            handleDisplayMsg(false, "Please fix errors before submitting.");
        };
    };

    return (
        <dialog className="form-modal" id="create-task-modal">
            <form method="POST" onSubmit={handleSubmit} noValidate>
                <h2>Add New Task</h2>
                <label htmlFor="task">Title *</label>
                <input type="text" id="task" name="task" onChange={handleChange} placeholder="e.g., Take coffee break" maxLength={30} required />
                {errMsg ? <p className="err-msg">{errMsg}</p> : null}
                <label htmlFor="desc">Description</label>
                <textarea rows={5} id="desc" name="desc" onChange={handleChange} placeholder="e.g., It's always good to take a break. his 15 minute break will recharge the batteries a little." maxLength={200} />
                <Fields type="subtask" values={subtaskValues} setValues={setSubtaskValues} counterRef={counterRef} />
                <label htmlFor="column">Column *</label>
                <select name="column" id="column" defaultValue={curCol} onChange={(e) => setUpdatedColId(e.target.value)}>
                    {colOptions}
                </select>
                {curBoard?.contributors?.length > 0 ?
                    <>
                        <label htmlFor="assignees">Assign to:</label>
                        <select name="assignees" id="assignees" onChange={handleAddAssignee} value="">
                            <option disabled value="" />
                            <option key={curBoard?.creator.userId} value={curBoard?.creator.userId}>{`${curBoard?.creator.userName} - Creator`}</option>
                            {assigneeOptions}
                        </select>
                        <div className="chosen-assignees">
                            {chosenAssignees}
                        </div>
                    </> : null
                }
                <label htmlFor="deadline">Deadline</label>
                <input ref={deadlineRef} type="date" id="deadline" name="deadline" />
                <button type="submit" className="save-btn">Create Task</button>
            </form>
            <button className="close-modal" type="button" onClick={handleCreateTaskModal}>
                <svg viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg"><g fillRule="evenodd"><path d="m12.728 0 2.122 2.122L2.122 14.85 0 12.728z"/><path d="M0 2.122 2.122 0 14.85 12.728l-2.122 2.122z"/></g></svg>
            </button>
        </dialog>
    );
};

export default CreateTask;

