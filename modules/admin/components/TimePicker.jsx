import React from "react";
import { Component } from "../utils/index.jsx";
import { InputGroup, InputGroupAddon, InputGroupText } from "reactstrap";
import Datetime from "react-datetime"
import PropTypes from "prop-types";
import InputMask from "react-input-mask";

class TimePicker extends Component {

    static get propTypes () {
        return {
            value: PropTypes.string,
            onChange: PropTypes.func.isRequired
        }
    }

    render () {
        let { value, onChange } = this.props;
        return (
            <Datetime
                dateFormat={false}
                timeFormat={"HH:mm"}
                defaultValue={value || ""}
                onChange={date => {
                    let value = date && date.toDate && date;
                    if (value) {
                        value = value.format("HH:mm")
                        onChange({ target: { value }});
                        return;
                    }

                    onChange({ target: { value: "" }});
                }}
                renderInput={props => {
                    return (
                        <InputGroup>
                            <InputMask
                                value={props.value}
                                onClick={props.onClick}
                                onChange={props.onChange}
                                className="form-control"
                                placeholder="HH:mm"
                                mask="99:99"
                            />
                            <InputGroupAddon addonType="append">
                                <InputGroupText>
                                    <div className="fa fa-clock-o" />
                                </InputGroupText>
                            </InputGroupAddon>
                        </InputGroup>
                    )
                }}
            />
        )
    }
}

export default TimePicker;