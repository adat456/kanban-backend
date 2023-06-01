import React, { useState, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { BoardsContext, CurBoardIdContext, contributorType } from "../../Context";

interface Prop {
    setContributorModal: React.Dispatch<React.SetStateAction<boolean>>,
    // initial value of contributorsLifted can be null, or a non-empty array if contributors have already been added during CreateBoard
    // it can also be undefined or a non-empty array, if opened from EditBoard 
    contributorsLifted: contributorType[] | null | undefined,
    setContributorsLifted: React.Dispatch<React.SetStateAction<contributorType[] | null | undefined>>,
    contributorCounter: number,
    setContributorCounter: React.Dispatch<React.SetStateAction<number>>
};

const ContributorModal: React.FC<Prop> = function({ setContributorModal, contributorsLifted, setContributorsLifted, contributorCounter, setContributorCounter }) {
    const [ search, setSearch ] = useState("");
    const [ result, setResult ] = useState<contributorType | null>(null);
    // state is separate (only taking a prop in as an initial value) because this dialog has save and close buttons--the latter of which will delete any changes that were made without saving. if the parent's state was constantly being updated with a passed in setter, then changes that were not explicitly saved would still be saved, which is not desirable in this scenario
    const [ contributors, setContributors ] = useState<contributorType[] | undefined | null>(contributorsLifted);

    // keys will sometimes repeat if this modal is repeatedly opened and closed and changes are made, so its true value is tracked by the parent
    const counterRef = useRef(contributorCounter);

    const boardsDataPair = useContext(BoardsContext);
    const { boardsData, setBoardsData } = boardsDataPair;
    const curBoardIdPair = useContext(CurBoardIdContext);
    const { curBoardId } = curBoardIdPair;
    const curBoard = boardsData?.find(board => board._id === curBoardId);


    const navigate = useNavigate();

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setSearch(e.target.value);
        if (result) setResult(null);
    };

    async function handleFetchSearchMatches(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        try {
            const req = await fetch(`/api/search/${search}`, { credentials: "include"});
            const res = await req.json();
            if (req.ok) {
                // adding a property to the results object if contributor had already been added - will be used to disable button
                if (contributors && contributors?.find(contributor => contributor.userId === res.userId) || curBoard?.creator.userId === res.userId) {
                    setResult({
                        ...res,
                        alreadyAdded: true,
                    });                
                } else {
                    setResult(res);
                };
            } else {
                throw new Error(res);
            };
        } catch(err) {
            if (err.message === "No JWT found.") navigate("/log-in");
        };
    };

    // need to somehow display error message

    function addContributor() {
        if (result) {
            if (contributors) {
                setContributors([
                    ...contributors, 
                    { ...result, key: counterRef.current }
                ]);
            } else {
                setContributors([
                    {...result, key: counterRef.current }
                ]);
            };
        };
        counterRef.current = counterRef.current + 1;
        setResult(null);
    };

    let contributorsArr = contributors?.map(contributor => {
        return (
            // in the case of EditBoard, contributors will only have a userID, not a key; hence the || short circuiting, which returns the last value by default
            <div key={contributor.key || contributor.userId} className="contributor">
                <p>{contributor.userName}</p>
                <select name="status" id="status" data-id={contributor.userId} defaultValue={contributor.userStatus} onChange={handleStatusChange}>
                    <option value="Co-creator">Co-creator</option>
                    <option value="Member">Member</option>
                    <option value="Viewer">Viewer</option>
                </select>
                <button type="button" onClick={() => handleRemoval(contributor.userId)} title="Remove contributor">
                    <svg aria-hidden="true" focusable="false" viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg"><g fillRule="evenodd"><path d="m12.728 0 2.122 2.122L2.122 14.85 0 12.728z"/><path d="M0 2.122 2.122 0 14.85 12.728l-2.122 2.122z"/></g></svg>
                    <span className="sr-only">Remove contributor</span>
                </button>
            </div>
        );
    });

    function handleRemoval(id: string) {
        if (contributors) setContributors(contributors.filter(contributor => contributor.userId !== id));
    };

    function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const id = e.target.getAttribute("data-id");
        if (contributors) setContributors(contributors.map(contributor => {
            if (contributor.userId === id) {
                return {
                    ...contributor,
                    userStatus: e.target.value
                };
            } else {
                return contributor;
            };
        }));
    };

    function handleSubmitContributors(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        // send the updated contributors list to the parent, who will add it to board details during its own board creation POST request
        setContributorsLifted(contributors);
        // send current value of counterRef back up to parent, so that parent can track what key we're on and prevent counterRef from resetting if ContributorModal is opened again... prevents key duplication
        setContributorCounter(counterRef.current);

        handleContributorModal();
    };

    function handleContributorModal() {
        const modal: HTMLDialogElement | null = document.querySelector("#contributor-modal");
        modal?.close();
        setContributorModal(false);
    };

    return (
        <dialog className="form-modal" id="contributor-modal">
            <h2>Add Contributors</h2>
            <form onSubmit={handleFetchSearchMatches}>
                <label>Search by username or email:</label>
                <div className="search-bar">
                    <input type="text" name="search" value={search} onChange={handleChange} placeholder='e.g., "lieutenantworf" or "lt.worf@starfleet.gov"' />
                    <button type="submit">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" clipRule="evenodd" d="M10 5C7.23858 5 5 7.23858 5 10C5 12.7614 7.23858 15 10 15C11.381 15 12.6296 14.4415 13.5355 13.5355C14.4415 12.6296 15 11.381 15 10C15 7.23858 12.7614 5 10 5ZM3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10C17 11.5719 16.481 13.0239 15.6063 14.1921L20.7071 19.2929C21.0976 19.6834 21.0976 20.3166 20.7071 20.7071C20.3166 21.0976 19.6834 21.0976 19.2929 20.7071L14.1921 15.6063C13.0239 16.481 11.5719 17 10 17C6.13401 17 3 13.866 3 10Z" /></svg>
                    </button>
                </div>
            </form>
            {result ? 
                result.alreadyAdded ?
                    <button type="button" className="potential-contributor" onClick={addContributor} disabled>{`+ ${result.userName}`}</button> :
                    <button type="button" className="potential-contributor" onClick={addContributor}>{`+ ${result.userName}`}</button>
                : null
            }
            <hr />
            <form onSubmit={handleSubmitContributors}>
                {contributorsArr}
                <button type="submit" className="save-btn">Save Contributors</button>
            </form>
            <button className="close-modal" type="button" onClick={handleContributorModal} title="Close modal">
                <svg aria-hidden="true" focusable="false" viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg"><g fillRule="evenodd"><path d="m12.728 0 2.122 2.122L2.122 14.85 0 12.728z"/><path d="M0 2.122 2.122 0 14.85 12.728l-2.122 2.122z"/></g></svg>
                <span className="sr-only">Close modal</span>
            </button>
        </dialog>
    );
};

export default ContributorModal;