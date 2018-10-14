import {
    Card,
    CardImg,
    CardBody,
    Button,
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter
} from "reactstrap"
import {
    Component,
    imgUrl
} from "../utils/index.jsx";
import React from "react"
import PropTypes from "prop-types"

class ImagesCard extends Component {
    render () {
        let { img, onClickDelete, i18n } = this.props;
        const stateModalRemove = "state-modal-remove";

        return (
            <Card 
                style={{
                    height: "100%"
                }}
            >
                <CardImg 
                    top 
                    width="100%" 
                    src={imgUrl(img._id)}
                />
                <CardBody className="d-flex align-items-end p-1">
                    {
                        img.name ?
                        <div className="w-100">
                            {img.name}
                        </div> : null
                    }

                    {
                        onClickDelete ?
                        <div className="text-right">
                            <div 
                                className="fa fa-trash text-danger cursor-pointer"
                                onClick={this.toggle(stateModalRemove)}
                            />

                            <Modal
                                isOpen={this.state[stateModalRemove]}
                                toggle={this.toggle(stateModalRemove)}
                            >
                                <ModalHeader className="bg-warning">
                                    {i18n.t("Attention!")}
                                </ModalHeader>
                                <ModalBody>
                                    {i18n.t("Are you sure remove image?")}
                                </ModalBody>
                                <ModalFooter>
                                    <Button
                                        onClick={() => {
                                            this.toggle(stateModalRemove)();
                                            onClickDelete(img._id);
                                        }}
                                        color="warning">
                                        {i18n.t("Confirm")}
                                    </Button>
                                    <Button
                                        onClick={this.toggle(stateModalRemove)}
                                        color="light">
                                        {i18n.t("Cancel")}
                                    </Button>
                                </ModalFooter>
                            </Modal>
                        </div> : null
                    }
                </CardBody>
            </Card>
        )
    }
}

ImagesCard.propTypes = {
    img: PropTypes.shape({
        _id: PropTypes.string.isRequired,
        name: PropTypes.string,
        onClickDelete: PropTypes.func
    }),
    i18n: PropTypes.object.isRequired,
    onClickDelete: PropTypes.func
}

export default ImagesCard;