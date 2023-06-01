import React, { useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BoardsContext, CurBoardIdContext, taskData, UserContext } from "../../Context";
import { handleDisplayMsg, fetchCatch } from "../helpers";
import Fields from "./Fields";

interface Prop {
    task: taskData,
    colId: string,
    setEditTaskVis: React.Dispatch<React.SetStateAction<boolean>>
};

interface assigneeInfo {
    userId: string,
    userName: string
};

const EditTask: React.FC<Prop> = function({ task, colId, setEditTaskVis }) {
    const [ taskName, setTaskName ] = useState(task.task);
    const [ errMsg, setErrMsg ] = useState("");
    const [ description, setDescription ] = useState(task.desc);
    const [ subtaskValues, setSubtaskValues ] = useState(task.subtasks.map(subtask => { return {id: subtask._id, value: subtask.subtask}}));
    const [ subtasksTBD, setSubtasksTBD ] = useState([]);
    const [ updatedColId, setUpdatedColId ] = useState(colId);
    const [ assignees, setAssignees ] = useState<assigneeInfo[]>(task.assignees);

    const counterRef = useRef(subtaskValues.length);
    const deadlineRef = useRef<HTMLInputElement | null>(null);

    const { boardsData, setBoardsData } = useContext(BoardsContext);
    const { curBoardId, setCurBoardId } = useContext(CurBoardIdContext);
    const curBoard = boardsData?.find(board => (board._id === curBoardId));
    const user = useContext(UserContext);

    const navigate = useNavigate();

    const colOptions = curBoard?.columns.map(col => {
        return (
            <option key={col._id} value={col._id}>{col.name}</option>
        );
    });

    function handleChange(e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) {
        const input = e.target;
        const field = e.target.getAttribute("id");

        if (field === "task") {
            // if there's an input at all 
            if (input.value !== "") { 
                // check that the task name is unique 
                let valid = true;
                curBoard?.columns.forEach(col => {
                    col.tasks.forEach(existingTask => {
                        if (existingTask._id !== task._id && existingTask.task.trim().toLowerCase() === input.value.trim().toLowerCase()) valid = false;
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

            setTaskName(input.value);
        };

        if (field === "description") setDescription(input.value);
    };

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

    function handleEditTaskModal() {
        const editTaskModal: HTMLDialogElement | null = document.querySelector(".edit-task-modal");
        editTaskModal?.close();
        
        setEditTaskVis(false);
    };

    function handleDeleteTaskModal(action: string) {
        const deleteTaskModal: HTMLDialogElement | null = document.querySelector(`#delete-task-modal`);
        if (action === "show") {
            const editTaskModal: HTMLDialogElement | null = document.querySelector(".edit-task-modal");
            editTaskModal?.close();
            deleteTaskModal?.showModal();
        };
        if (action === "close") {
            deleteTaskModal?.close();
            setEditTaskVis(false);
        };
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!errMsg) {
            let subtasks: {name: string, id: string, status: boolean}[] = [];     
            subtaskValues.forEach(subtask => {
                if (subtask.value) subtasks.push({ name: subtask.value, id: subtask.id, status: false })
            });

            const reqOptions: RequestInit = {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({  
                    boardId: curBoardId,
                    colId, 
                    taskId: task._id,
                    task: taskName,
                    desc: description,
                    updatedSubtasks: [...subtasks, ...subtasksTBD],
                    updatedColId,
                    deadline: deadlineRef?.current?.value,
                    assignees
                }),
                credentials: "include"
            };

            try {
                const req = await fetch("/api/edit-task", reqOptions);
                // may be updated boards data
                const res = await req.json();
                if (req.ok) {
                    handleDisplayMsg(true,"Task updated.");

                    let updatedBoardsData = boardsData?.map(board => {
                        if (board._id === res._id) {
                            return res;
                        } else {
                            return board;
                        };
                    });
                    if (updatedBoardsData) setBoardsData(updatedBoardsData);

                    handleEditTaskModal();
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
            const req = await fetch(`/api/delete-task/${curBoardId}/${colId}/${task._id}`, { method: "DELETE", credentials: "include" });
            // may return updated boards data
            const res = await req.json();
            if (req.ok) {
                handleDisplayMsg(true, "Task deleted.");

                let updatedBoardsData = boardsData?.map(board => {
                    if (board._id === res._id) {
                        return res;
                    } else {
                        return board;
                    };
                });
                if (updatedBoardsData) setBoardsData(updatedBoardsData);
                
                handleDeleteTaskModal("close");
            } else {
                throw new Error(res);
            };
        } catch(err) {
            fetchCatch(err, navigate);
        };
    };

    return (
        <>
            <dialog className="form-modal edit-task-modal">
                <form method="POST" className="edit-task" onSubmit={handleSubmit} noValidate>
                    <h2>Edit Task</h2>
                    <label htmlFor="task">Title</label>
                    <input type="text" id="task" name="task" defaultValue={task.task} onChange={handleChange} maxLength={30} required />
                    {errMsg ? <p className="err-msg">{errMsg}</p> : null}
                    <label htmlFor="description">Description</label>
                    <textarea id="description" name="description" value={description} onChange={handleChange} rows={5} maxLength={200} />
                    <Fields type="subtask" values={subtaskValues} setValues={setSubtaskValues} counterRef={counterRef} valuesTBD={subtasksTBD} setValuesTBD={setSubtasksTBD} />
                    <label htmlFor="column">Column</label>
                    <select name="column" id="column" defaultValue={colId} onChange={(e) => setUpdatedColId(e.target.value)} >
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
                    <input ref={deadlineRef} type="date" id="deadline" name="deadline" defaultValue={task?.deadline?.slice(0, 10)} />
                    <button type="submit" className="save-btn">Save Changes</button>
                    <button type="button" className="delete-btn" onClick={() => handleDeleteTaskModal("show")}>Delete Task</button>
                    <button className="close-modal" type="button" onClick={handleEditTaskModal} title="Close modal">
                        <svg aria-hidden="true" focusable="false" viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg"><g fillRule="evenodd"><path d="m12.728 0 2.122 2.122L2.122 14.85 0 12.728z"/><path d="M0 2.122 2.122 0 14.85 12.728l-2.122 2.122z"/></g></svg>
                        <span className="sr-only">Close modal</span>
                    </button>
                </form>
            </dialog>
            <dialog className="delete-modal" id="delete-task-modal">
                <h2>Delete this task?</h2>
                <p>{`Are you sure you want to delete the '${task.task}' task and its subtasks? This action cannot be reversed.`}</p>
                <div className="delete-btn-cluster">
                    <button type="button" onClick={handleDelete} className="delete-btn">Delete</button>
                    <button type="button" onClick={() => handleDeleteTaskModal("close")} className="add-btn">Cancel</button>
                </div>
            </dialog>
        </>
    );
};

export default EditTask;