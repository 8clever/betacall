import * as __progress from "../store/Progress.jsx"
import React from "react"
import { observer } from "mobx-react-lite";

const Progress = observer(props => {
    const { color = "red", height = 5 } = props;
    const [ percent, setPercent ] = React.useState(0);

    React.useEffect(() => {
        const timeout = setTimeout(() => {
            if (!__progress.store.isLoading) return;
            let tt = ((100 - percent) / 100) * 3;
            let newPercent = tt + percent;
            setPercent(newPercent);
        }, 10);
       
        return () => clearTimeout(timeout);
    }, [__progress.store.isLoading, percent]);

    React.useEffect(() => {
        if (__progress.store.isLoading) return;

        const timeout = setTimeout(() => {
            setPercent(0);
        }, 1000);
        setPercent(100);

        return () => clearTimeout(timeout);
    }, [__progress.store.isLoading]);

    return <div style={{
        width: "100%",
        position: "absolute",
        zIndex: 10000
    }}>
        <div style={{
            width: `${percent}%`,
            backgroundColor: color,
            height: `${height}px`
        }} />
    </div>
})

export default Progress;