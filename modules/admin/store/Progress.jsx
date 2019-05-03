import { observable } from "mobx";

export const store = observable({
    isLoading: false
});

export const actions = {
    loading: () => {
        if (!global.isBrowser) return;
        store.isLoading = true;
    },

    stopLoading: () => {
        if (!global.isBrowser) return;
        store.isLoading = false;
    }
}