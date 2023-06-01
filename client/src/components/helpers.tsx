import { NavigateFunction } from "react-router-dom";
import { isAlphanumeric, isEmail } from "validator";

export let handleDisplayMsg: (ok: boolean, message: string) => void = function(ok, message) {
    const displayMsgModal: HTMLDialogElement | null = document.querySelector(".display-msg-modal");
    if (displayMsgModal) {
        displayMsgModal.textContent = message;
        if (!ok) displayMsgModal.classList.add("error");
        displayMsgModal.show();
    };  

    setTimeout(() => {
        if (displayMsgModal) {
            displayMsgModal.close();
            displayMsgModal.classList.remove("error");
        };   
    }, 3000);
};

// for when the JWT has expired ==> direct to log-in page
// or when back end is throwing some kind of error ==> display it in the error modal
// ok will always be false and message will always be err.message
export let fetchCatch: (err: any, navigate: NavigateFunction) => void = function(err, navigate) {
    if (err.message === "No JWT found.") {
        // state can be accessed by the /log-in component with the useLocation hook
        // informs user that they were logged out for a reason
        navigate("/log-in", {state: {logOutMsg: "Logged out due to inactivity."}});
    } else {
        handleDisplayMsg(false, err.message);
    };
};

// SIGN UP FORM VALIDATIONS
// for strings that are just required
export let validateReqString: (input: HTMLInputElement, msgSetter: React.Dispatch<React.SetStateAction<string>>) => void = function(input, msgSetter) {
    if (input.validity.valueMissing) {
        msgSetter("Field required.");
        input.setCustomValidity("Field required.");
    } else {
        msgSetter("");
        input.setCustomValidity("");
    };
};

export let validateEmail: (input: HTMLInputElement, msgSetter: React.Dispatch<React.SetStateAction<string>>) => void = function(input, msgSetter) {
    if (input.validity.valueMissing) {
        msgSetter("Field required.");
        input.setCustomValidity("Field required.");
        return;
    } else if (!isEmail(input.value)) {
        msgSetter("Please enter a valid email address.");
        input.setCustomValidity("Please enter a valid email address.");
        return;
    } else {
        msgSetter("");
        input.setCustomValidity("");
    };
};

// for username and password
export let validateCred: (input: HTMLInputElement, msgSetter: React.Dispatch<React.SetStateAction<string>>) => void = function(input, msgSetter) {
    if (input.validity.valueMissing) {
        msgSetter("Field required.");
        input.setCustomValidity("Field required.");
        return;
    } else if (!isAlphanumeric(input.value)) {
        msgSetter("May only contain letters and/or numbers.");
        input.setCustomValidity("May may only contain letters and/or numbers.");
        return;
    } else if (input.validity.tooShort) {
        msgSetter("Must be between 7 and 15 characters long.");
        input.setCustomValidity("Username must be between 7 and 15 characters long.");
        return;
    } else {
        msgSetter("");
        input.setCustomValidity("");
    };
};

export function handleVisToggle(e) {
    console.log("clicked");
    const fieldId = e.currentTarget.getAttribute("data-id");
    const field = document.querySelector(`#${fieldId}`);
    console.log(field);
    if (field?.getAttribute("type") === "password") {
        field?.setAttribute("type", "text");
    } else {
        field?.setAttribute("type", "password");
    };
}; 

// extract info about missing fields (thrown by MongoDB model validation) for error display message
export let extractErrMsg: (errMsg: string) => string = function(errMsg) {
    const errMessages = errMsg.slice(24);
    let errMsgArr = errMessages.split(",");
    let displayMsg = "";
    errMsgArr = errMsgArr.map(errMsg => {
        const errArr = errMsg.split(":");
        displayMsg += errArr[1];
    });
    return displayMsg;
};




