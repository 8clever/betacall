import * as __progress from "../store/Progress.jsx";
import * as __info from "../store/InfoStore.jsx";

export default async (fn) => {
    try {
        __progress.actions.loading();
        await fn()
        __progress.actions.stopLoading();
    } catch(err) {
        __progress.actions.stopLoading();
        __info.actions.addInfo(err);
    }
}