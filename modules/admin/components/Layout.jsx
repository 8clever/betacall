import React from "react";
import Reflux from "reflux";
import Empty from '../components/Empty.jsx';
import Progress from '../components/Progress.jsx';
import ClientInfo from "../components/ClientInfo.jsx";
import { SideMenu } from "react-sidemenu";
import { withError, token, api, redirect, __, I18n } from "../utils/index.jsx";
import _, { assign } from "lodash";
import {
    Card,
    CardBody,
    Button,
    Dropdown,
    DropdownToggle,
    DropdownMenu,
    DropdownItem,
    Modal,
    ModalHeader,
    ModalFooter,
    ModalBody
} from "reactstrap";
import Fa from "./Fa.jsx";
import RedirectStore from "../store/Redirect.jsx";
import MenuStore from "../store/Menu.jsx";
import Actions from "../store/actions.jsx";

class Layout extends Reflux.Component {
    constructor(props) {
        super(props);
        this.state = {};
        this.stores = [
            MenuStore,
            RedirectStore
        ];
        this.checkLeftMenu = this.checkLeftMenu.bind(this);
        this.checkLeftItem = this.checkLeftItem.bind(this);
    }

    signOut() {
        return () => {
           withError(async () => {
               let t = token.get({});
               await api("users.logout", t, {});
               token.rm();
               global.router.reload();
           });
        }
    }

    toggle(name) {
        return () => {
            let state = assign({}, this.state);
            _.set(state, name, !this.state[name]);
            this.setState(state);
        }
    }

    UNSAFE_componentWillReceiveProps (props) {
        if (props.title) {
            document.title = props.title;
        }
    }

    componentDidMount () {
        this.UNSAFE_componentWillReceiveProps(this.props);
    }

    checkLeftMenu() {
        return this.state["left-menu"] ? "d-flex d-block" : "d-none d-sm-block"
    }

    checkLeftItem(icon, name) {
        return (
            <div className="d-flex">
                <div 
                    className="text-center" 
                    style={{
                        width: 15
                    }}
                >
                    {
                        icon ? 
                        <Fa fa={icon} /> : null 
                    }
                </div>

                {
                    this.state["left-menu"] ?
                    <div className="w-100 px-2">
                        {name}
                    </div> : null
                }
            </div>
        )
    }

    render() {
        const { children, title, page, user } = this.props;
        const i18n = new I18n(user);
        
        const leftMenu = "left-menu";
        const stateLang = "state-lang";
        const items = [
            { 
                divider: true,
                label: this.checkLeftItem(null, i18n.t("Main Navigation")),
                value: _.uniqueId()
            },
            {
                label: this.checkLeftItem("home", i18n.t("Home")),
                onClick: () => { redirect(null, "index") },
                value: "home"
            },
            {
                label: this.checkLeftItem("users", i18n.t("Users")),
                onClick: () => { redirect(null, "users") },
                value: "users",
                permission: __.PERMISSION.USER.VIEW
            },
            { 
                label: this.checkLeftItem("power-off text-danger", i18n.t("Sign-Out")), 
                onClick: this.signOut(),
                value: _.uniqueId()
            }
        ]

        _.remove(items, item => {
            if (!item.permission) return false;
            return !checkPerm(item.permission);
        });

        function checkPerm (perm) {
            return user && user.security && user.security[perm] && user.security[perm].global;
        }

        return (
            <Empty align="align-items-start">
                <div className={ "Side-menu-parent d-sm-flex flex-column align-self-stretch " + this.checkLeftMenu() } style={{
                    minWidth: this.state[leftMenu] ? "200px" : null
                }}>
                    <SideMenu
                        items={items}
                        activeItem={page}
                    />
                    <div className="mt-auto">
                        <h2 className="p-2 text-center">
                            <span className="text-success">4</span>all
                        </h2>
                    </div>
                </div>
                <div className="align-self-stretch w-100 d-flex flex-column" style={{ minWidth: "320px" }}>
                    <Card>
                        <CardBody className="d-flex p-1 pb-2">
                            <div>
                                <Button 
                                    color="light" 
                                    size="sm"
                                    className="rounded-0" 
                                    onClick={() => {
                                        Actions.toggleMenu(leftMenu);
                                    }}>
                                    <Fa fa="bars" />
                                </Button>
                            </div>
                            <div className="w-100 pl-2">
                                <span className="h4 text-muted">
                                    <span className="small">{__.COMPANY_NAME}: {title}</span>
                                </span>
                            </div>
                            <div className="text-right w-100">
                                {
                                    user && user.name ?
                                    <Button
                                        className="rounded-0 mr-1"
                                        color="secondary"
                                        size="sm"
                                        outline
                                    >
                                        <Fa fa="user"/> {user.name}
                                    </Button> : null
                                }

                                {
                                    user && user.lang ?
                                    <Dropdown 
                                        direction="left"
                                        className="pull-right"
                                        isOpen={!!this.state[stateLang]} 
                                        toggle={this.toggle(stateLang)}>
                                        <DropdownToggle 
                                            className="rounded-0"
                                            color="secondary"
                                            size="sm"
                                            outline
                                            caret>
                                            {user.lang}
                                        </DropdownToggle>
                                        <DropdownMenu>
                                            {
                                                _.map(__.LANGS, (lang, idx) => {
                                                    if (lang === user.lang) return null;
                                                    return (
                                                        <DropdownItem 
                                                            key={idx}
                                                            onClick={() => {
                                                                withError(async () => {
                                                                    await api("users.editUser", token.get(), {
                                                                        data: {
                                                                            _id: user._id,
                                                                            lang: lang
                                                                        }
                                                                    });
                                                                    global.router.reload();
                                                                });
                                                            }}>
                                                            {lang}
                                                        </DropdownItem>
                                                    )
                                                })
                                            }
                                        </DropdownMenu>
                                    </Dropdown> : null
                                }
                            </div>
                        </CardBody>
                    </Card>

                    <div className="d-flex ml-2 mt-2" style={{ position: "absolute" }}>
                        <ClientInfo />
                    </div>
                
                    <Modal isOpen={!!this.state.stateAlertRedirect}>
                        <ModalHeader>{i18n.t("Attention!")}</ModalHeader>
                        <ModalBody>{i18n.t("Are you sure leave the page?")}</ModalBody>
                        <ModalFooter>
                            <Button 
                                onClick={Actions.redirectFromAlert}
                                color="warning">
                                {i18n.t("Confirm")}
                            </Button>
                            <Button 
                                onClick={Actions.hideRedirectAlert}
                                color="light">
                                {i18n.t("Cancel")}
                            </Button>
                        </ModalFooter>
                    </Modal>
                    
                    <div className="w-100 flex-column flex-sm-row d-flex scroll-parent">
                        {children}
                    </div>
                </div>
            </Empty>
        )
    }
}

class Document extends React.Component {
    render() {
        let { children, empty } = this.props;
        return (
            <div>
                <Progress height={3} />
                {
                    empty ?
                    <Empty {...this.props}>
                        { children }
                    </Empty> 
                    :
                    <Layout {...this.props}>
                        {children}
                    </Layout>
                }
            </div>
        )
    }
}

export default Document;