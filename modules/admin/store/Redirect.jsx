
import { observable } from "mobx";

export const store = observable({
    stateAlertRedirect: false
});

export const actions = {

    disableRedirect: () => {
        global.disableRedirects = true;
    },

    enableRedirect: () => {
        global.disableRedirects = false;
        store.disableRedirects = false;
        store.stateRedirectFn = false;
    },

    showRedirectAlert: redirect => {
        store.stateAlertRedirect = true;
        store.stateRedirectFn = redirect;
    },

    redirectFromAlert: () => {
        actions.hideRedirectAlert();
        store.stateRedirectFn();
        actions.enableRedirect();
    },

    hideRedirectAlert: () => {
        store.stateAlertRedirect = false;
    }
}