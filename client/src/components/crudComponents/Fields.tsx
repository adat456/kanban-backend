import React from "react";

interface Prop {
    type: string,
    counterRef: React.MutableRefObject<number>,
    values: {id: string, value: string}[],
    setValues: React.Dispatch<React.SetStateAction<{id: string, value: string}[]>>,
    valuesTBD?: {id: string, name: string}[],
    setValuesTBD?: React.Dispatch<React.SetStateAction<{id: string, name: string}[]>>
};

const Fields: React.FC<Prop> = function({ type, values, setValues, counterRef, valuesTBD, setValuesTBD }) {
    // note that the React elements are NOT stored in state, only the values used to generate these elements
    let fields = values.map(item => {
        return (
            <label key={item.id} htmlFor={`${type}${item.id}`} className={`${type}-label`}>
                <input type="text" id={`${type}${item.id}`} value={item.value} data-id={item.id} onChange={handleChange} maxLength={50} />
                <button type="button" onClick={() => handleRemoval(item.id)} title="Remove">
                    <svg aria-hidden="true" focusable="false" viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg"><g fillRule="evenodd"><path d="m12.728 0 2.122 2.122L2.122 14.85 0 12.728z"/><path d="M0 2.122 2.122 0 14.85 12.728l-2.122 2.122z"/></g></svg>
                    <span className="sr-only">Remove</span>
                </button>
            </label>
        );
    });

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const id = e.target.getAttribute("data-id");
        // really great way to replace/change an object in an array of objects
        // if the object matches, change and return it
        // if it does not, return it unchanged
        setValues(values.map(item => {
            if (id == item.id) {
                return { id, value: e.target.value };
            } else {
                return item;
            };
        }));
    };

    function handleRemoval(itemId: string) {
        // removes item from the values array so that user can no longer see it...
        setValues(values.filter(item => item.id !== itemId));
        // and if it is an edit task/board form that received a deletion array...
        // ...adds the item to the array of values to be deleted (with the ID, but an empty string for the name so that the backend can recognize that it needs to be deleted)
        if (valuesTBD && setValuesTBD) setValuesTBD([...valuesTBD, {id: itemId, name: ""}]);
    };

    function handleAddition() {
        setValues([
            ...values,
            { id: counterRef.current.toString(), value: "" }
        ]);
        counterRef.current = counterRef.current + 1;
    };

    return (
        <fieldset>
            <legend>{type === "col" ? "Columns" : "Subtasks"}</legend>
            {fields}
            <button type="button" className="add-btn" onClick={handleAddition}>{type === "col" ? "+ Add New Column" : "+ Add New Subtask"}</button>
        </fieldset>
    );
};

export default Fields;