import React from "react";

class Fa extends React.Component {
    render () {
        let { fa, className, size, onClick } = this.props;
        return (
            <i 
                onClick={ onClick }
                className={ `fa fa-${ fa } ${ className } fa-${ size }x` }>
            </i>
        )
    }
}

export default Fa;