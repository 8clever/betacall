import React from 'react';
import PropTypes from "prop-types";

class ReactFileReader extends React.Component {
    constructor(props) {
        super(props);
        this.fileInput = null;

        this.setFileInput = this.setFileInput.bind(this);
        this.clickInput = this.clickInput.bind(this);
        this.handleFiles = this.handleFiles.bind(this);
        this.convertFilesToBase64 = this.convertFilesToBase64.bind(this);
    }

    setFileInput(element) {
        this.fileInput = element;
    }

    clickInput() {
        const element = this.fileInput;
        element.value = '';
        element.click();
    }

    handleFiles(event) {
        if (this.props.base64) {
            this.convertFilesToBase64(event.target.files);
        } else {
            this.props.handleFiles(event.target.files);
        }
    }

    convertFilesToBase64(files) {
        let ef = files;

        if (this.props.multipleFiles) {
            let files = { base64: [], fileList: ef };

            for (var i = 0, len = ef.length; i < len; i++) {
                let reader = new FileReader();
                let f = ef[i];

                reader.onloadend = e => {
                    files.base64.push(reader.result);

                    if (files.base64.length === ef.length) {
                        this.props.handleFiles(files);
                    }
                }

                reader.readAsDataURL(f);
            }
        } else {
            let files = { base64: '', fileList: ef };
            let f = ef[0];
            let reader = new FileReader();

            reader.onloadend = e => {
                files.base64 = reader.result;
                this.props.handleFiles(files);
            }

            reader.readAsDataURL(f);
        }
    }

    static get defaultProps() {
        return {
            fileTypes: 'image/*',
            multipleFiles: false,
            base64: false,
            disabled: false
        }
    }

    static get propTypes() {
        return {
            multipleFiles: PropTypes.bool,
            handleFiles: PropTypes.func.isRequired,
            fileTypes: PropTypes.oneOfType([
                PropTypes.string,
                PropTypes.array
            ]),
            base64: PropTypes.bool,
            children: PropTypes.element.isRequired,
            disabled: PropTypes.bool,
            elementId: PropTypes.string
        }
    }

    render() {
        var hideInput = {
            width: '0px',
            opacity: '0',
            position: 'fixed'
        }

        const optionalAttributes = {};
        if (this.props.elementId) {
            optionalAttributes.id = this.props.elementId;
        }

        return (
            <span className='react-file-reader'>
                <input type='file'
                    onChange={this.handleFiles}
                    accept={Array.isArray(this.props.fileTypes) ? this.props.fileTypes.join(',') : this.props.fileTypes}
                    className='react-file-reader-input'
                    ref={this.setFileInput}
                    multiple={this.props.multipleFiles}
                    style={hideInput}
                    disabled={this.props.disabled}
                    {...optionalAttributes}
                />

                <span className='react-file-reader-button' onClick={this.clickInput}>
                    {this.props.children}
                </span>
            </span>
        )
    }
}

class FileReader extends React.Component {
    constructor(props) {
        super(props)
    }

    static get defaultProps() {
        return {
            fileTypes: [
                ".xls",
                ".xlsx"
            ],
            disabled: false,
            handleFiles: function () { },
            multipleFiles: false
        }
    }

    render() {
        let { fileTypes, disabled, handleFiles, multipleFiles, children } = this.props;

        return (
            <ReactFileReader
                handleFiles={handleFiles}
                fileTypes={fileTypes}
                disabled={disabled}
                multipleFiles={multipleFiles}>
                {children}
            </ReactFileReader>
        )
    }
}

export default FileReader;
