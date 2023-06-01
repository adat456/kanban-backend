import { useRef, useState, useEffect, useContext } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import ViewTask from "../crudComponents/ViewTask";
import EditTask from "../crudComponents/EditTask";
import { taskData } from "../../Context";

interface Prop {
    task: taskData,
    order: number,
    colId: string,
};

const Task: React.FC<Prop> = function({ task, order, colId }) {
    const dragHandleRef = useRef<HTMLDivElement | null>(null);

    const [ viewTaskVis, setViewTaskVis ] = useState(false);
    const [ editTaskVis, setEditTaskVis ] = useState(false);

    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        // all of this data is sent to DndContext in Board.tsx to be processed by onDragStart (and onDragEnd)
        id: task._id,
        data: {
            order,
            colId
        }
    });

    let numCompleteSubtasks = 0;
    if (task.subtasks) {
        task.subtasks.forEach(subtask => {
            if (subtask.status) numCompleteSubtasks++;;
        });
    };

    const style = {
        transform: CSS.Translate.toString(transform),
        touchAction: "none"
    };

    function handleDragHandleVis(boolean: boolean) {
        if (boolean) {
            dragHandleRef?.current?.classList.remove("hidden");
            dragHandleRef?.current?.classList.add("dragHandle");
        };
        if (!boolean) {
            dragHandleRef?.current?.classList.add("hidden");
            dragHandleRef?.current?.classList.remove("dragHandle");
        };
    };

    useEffect(() => {
        if (viewTaskVis) {
            const viewTaskModal: HTMLDialogElement | null = document.querySelector(".view-task-modal");
            viewTaskModal?.showModal();
        };
    }, [viewTaskVis]);

    useEffect(() => {
        if (editTaskVis) {
            const editTaskModal: HTMLDialogElement | null = document.querySelector(".edit-task-modal");
            editTaskModal?.showModal();
        };
    }, [editTaskVis]);

    return (
        <>
            <button type="button" ref={setNodeRef} style={style} className={task.completed ? "task completed" : "task"} onMouseEnter={() => handleDragHandleVis(true)} onMouseLeave={() => handleDragHandleVis(false)} onClick={() => setViewTaskVis(viewTaskVis => true)}>
                <div>
                    <span className="task-name">{task.task}</span>
                    {task.subtasks.length > 0 ? 
                        <span className="subtasks">{`${numCompleteSubtasks} of ${task.subtasks.length} subtasks`}</span> : <></>
                    }
                </div>
                <div className="hidden" ref={dragHandleRef} {...listeners} {...attributes} title="Click and drag to move task between columns">
                    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" fill="#828FA3" stroke="#828FA3"><g id="SVGRepo_bgCarrier" strokeWidth="0"/><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"/><g id="SVGRepo_iconCarrier"><path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" fill="#828FA3"/></g></svg>
                </div>
            </button>
            {viewTaskVis ? <ViewTask task={task} colId={colId} numCompleteSubtasks={numCompleteSubtasks} setViewTaskVis={setViewTaskVis} setEditTaskVis={setEditTaskVis} /> : null }
            {editTaskVis ? <EditTask task={task} colId={colId} setEditTaskVis={setEditTaskVis} /> : null }
        </>
    );
};

export default Task;