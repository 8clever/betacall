
import { observable } from "mobx";

export const store = observable({});

export const actions = {
    toggleMenu: name => {
        store[name] = !store[name];
    }
}