import Actions from "../store/actions.jsx"

export default async (fn) => {
    try {
        Actions.loading();
        await fn()
        Actions.stopLoading();
    } catch(err) {
        Actions.stopLoading();
        Actions.addInfo(err);
    }
}