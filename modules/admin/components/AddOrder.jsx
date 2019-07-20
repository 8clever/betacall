import React from 'react';
import { 
  Button, 
  Modal, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Label,
  Input
} from "reactstrap";
import FormItem from 'antd/lib/form/FormItem';
import { api, withError, token } from "../utils/index.jsx";

export const AddOrder = ({ i18n }) => {
  const [ modalIsOpen, setModalIsOpen ] = React.useState(false);
  const [ orderId, setOrderID ] = React.useState("");
  
  return (
    <div>
      <Button
        color="light"
        onClick={() => setModalIsOpen(true)}
      >
        {i18n.t("Assign Order")}
      </Button>
      <Modal 
        isOpen={modalIsOpen} 
        toggle={setModalIsOpen}>
        <ModalHeader>
          {i18n.t("Assign Order")}
        </ModalHeader>
        <ModalBody>
          <FormItem>
            <Label>
              OrderID
            </Label>
            <Input 
              value={orderId}
              onChange={e => {
                setOrderID(e.target.value);
              }}
            />
          </FormItem>
        </ModalBody>
        <ModalFooter>
          <Button
            onClick={() => {
              withError(async () => {
                await api("order.addToMyOrders", token.get(), {
                  orderId,
                  callId: Math.random()
                })
                setOrderID("");
                setModalIsOpen(false);
                global.router.reload();
              })
            }}
            color={"primary"}
          >
            {i18n.t("Save")}
          </Button>
          <Button
            color="light"
            onClick={() => {
              setModalIsOpen(false)
            }}
          >
            {i18n.t("Cancel")}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}