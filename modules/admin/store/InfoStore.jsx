
import { observable } from "mobx";

let _id = 0;

export const store = observable({
    infos: []
});

export const actions = {
    addInfo: info => {
        _id ++;
        info.visible = true;
        info.id = _id; 
        let infos = store.infos.concat([]);
        infos.push(info);
        store.infos = infos;

        setTimeout(() => {
            actions.hideInfoById(info.id);
        }, 10000);
    },

    hideInfoById: id => {
        let infos = store.infos.concat([]);
        infos.forEach((i, idx) => {
            if (id === i.id) {
                actions.hideInfo(idx);
            }
        });
    },

    hideInfo: idx => {
        let infos = store.infos.concat([]);
        infos[idx].visible = false;
        store.infos = infos;
    }
}