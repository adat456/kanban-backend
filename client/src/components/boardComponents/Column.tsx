import { useEffect, useState, useContext } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";

import { UserStatusContext, UserContext, ModeContext, columnData, taskData } from "../../Context";
import CreateTask from "../crudComponents/CreateTask";
import Task from "./Task";

interface Prop {
    col: columnData,
    columnsArr: columnData[],
    filters: string[],
};

const Column: React.FC<Prop> = function({ col, columnsArr, filters }) {
    const [ createTaskVis, setCreateTaskVis ] = useState(false);

    const user = useContext(UserContext);
    const userStatus = useContext(UserStatusContext);
    const mode = useContext(ModeContext);

    useEffect(() => {
        if (createTaskVis) {
            const createTaskModal: HTMLDialogElement | null = document.querySelector("#create-task-modal");
            createTaskModal?.showModal();
        };
    }, [createTaskVis]);

    // each column is a droppable...
    const { isOver, setNodeRef } = useDroppable({ id: col._id });
    const style = isOver ?  
        mode === "dark" ? 
            {
                backgroundColor: "rgba(43, 44, 55, 0.3)",
                padding: "2rem 1rem 0 1rem"
            } : 
            {
                backgroundColor: "#E9EFFA",
            padding: "2rem 1rem 0 1rem"
            }         
        : undefined;

    // but there are also droppable spaces, which consist of the joined column ID and order
    function filterAndSortTasks(taskArr: taskData[]) {
        let updatedTaskArr = taskArr;
        // filters
        if (filters.includes("assigned")) {
            updatedTaskArr = updatedTaskArr.filter(task => {
                let match;
                task.assignees.forEach(assignee => {
                    if (assignee.userId === user?._id) match = true;
                });
                // returns true if the task's assignees include the user, which will allow that task to pass the filter
                return match;
            });
        };
        if (filters.includes("incomplete")) {
            updatedTaskArr = updatedTaskArr.filter(task => {
                if (!task.completed) return true;
            });
        };
        if (filters.includes("overdue")) {
            const today = new Date().toISOString().slice(0, 10);
            updatedTaskArr = updatedTaskArr.filter(task => {
                if (task.deadline < today) return true;
            });
        };
        return updatedTaskArr;
    };
    const filteredAndSortedTasks = filterAndSortTasks(col.tasks);
    const taskArr = filteredAndSortedTasks?.map((task, index) => {
        return (
            <div key={task._id}>
                <Task task={task} order={index} colId={col._id} />
                <DroppableSpace id={`${col._id}${index + 1}`} />
            </div>
        );
    });

    return (
        <section style={style} ref={setNodeRef} className="column">
            <h2>{`${col.name} (${col.tasks.length})`}</h2>
            {(col.tasks.length > 0) ? <DroppableSpace id={`${col._id}0`} /> : null }
            {taskArr}
            {(userStatus === "Creator" || userStatus === "Co-creator") ?
                <>
                    <button type="button" className="add-task-btn" onClick={() => setCreateTaskVis(true)}>+ New Task</button>
                    {createTaskVis? <CreateTask setCreateTaskVis={setCreateTaskVis} curCol={col._id} columnsArr={columnsArr} /> : null }
                </>
                : null
            }
        </section>
    );
};

const DroppableSpace: React.FC<{id: string}> = function({ id }) {
    const { isOver, setNodeRef } = useDroppable({ id });

    // style (making the droppable space/line visible) is only applied when the task/droppable is over the element
    const lineStyle = isOver ? 
        {
            backgroundColor: "#E4EBFA",
            width: "100%",
            height: "2px",
            margin: "2rem 0",
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center"
        } : undefined;

    const numStyle = isOver ?
        {
            backgroundColor: "#E4EBFA",
            width: "2rem",
            height: "2rem",
            borderRadius: "50%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
        } : 
        {
            display: "none"
        };

    return (
        <div ref={setNodeRef} style={lineStyle} className="droppable-task-space">
            <div style={numStyle}>{Number(id.slice(-1)) + 1}</div>
        </div>
    );
};

export default Column;