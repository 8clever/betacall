import React from "react";
import PropTypes from "prop-types";
import {
    Card,
    CardBody
} from "reactstrap";
import Fa from "./Fa.jsx";

class Panel extends React.Component {

    static get defaultProps () {
        return {
            color: "primary",
            onClick: false,
            borderSize: "4px",
            selected: false
        }
    }

    static get propTypes () {
        return {
            color: PropTypes.string,
            onClick: PropTypes.oneOfType([
                PropTypes.func,
                PropTypes.bool
            ]),
            borderSize: PropTypes.string,
            selected: PropTypes.bool
        }
    }

    render () {
        let {
            borderSize,
            onClick,
            color,
            selected,
            children
        } = this.props;

        return (
            <Card 
                className={`mb-2 ${ onClick ? "hover-secondary" : ""} rounded-0`}>
                <CardBody
                    style={{
                        borderLeft: `${borderSize} solid #ccc`
                    }}
                    onClick={onClick && onClick || function() {}}
                    className={`
                        p-0
                        cursor-pointer 
                        border-${color}
                    `}>
                    <div className="d-flex">
                        <div className="w-100 p-3">
                            {children}
                        </div>
                        {
                            selected ?
                            <div className={`
                                px-2
                                bg-light
                                text-white
                                d-flex 
                                align-items-center
                            `}>
                                <Fa 
                                    className={`text-${color}`}
                                    fa="chevron-right" 
                                    size={2}
                                />
                            </div> : null
                        }
                    </div>
                </CardBody>
            </Card>
        )
    }
}

export default Panel;