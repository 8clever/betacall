import React from "react";
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
import * as __menu from "../store/Menu.jsx";
import * as __redirect from "../store/Redirect.jsx";
import { observer } from "mobx-react-lite";
import DevTools from "mobx-react-devtools";

const Layout = observer(props => {
    const { children, title, page, user } = props;

    const i18n = new I18n(user);
    const [ toggleState, setToggle ] = React.useState({});
    
    const leftMenu = "left-menu";
    const stateLang = "state-lang";

    const checkPerm = perm => {
        return user && user.security && user.security[perm] && user.security[perm].global;
    }

    const signOut = () => {
        withError(async () => {
            let t = token.get({});
            await api("users.logout", t, {});
            token.rm();
            global.router.reload();
        });
    }

    const toggle = name => () => {
        let state = assign({}, toggleState);
        state[name] = !toggleState[name];
        setToggle(state);
    }

    const checkLeftMenu = () => {
        return __menu.store["left-menu"] ? "d-flex d-block" : "d-none d-sm-block"
    }

    const checkLeftItem = (icon, name) => (
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
                __menu.store[leftMenu] ?
                <div className="w-100 px-2">
                    {name}
                </div> : null
            }
        </div>
    )

    React.useEffect(() => {
        document.title = props.title;
    }, [props.title])

    const items = [
        { 
            divider: true,
            label: checkLeftItem(null, i18n.t("Main Navigation")),
            value: _.uniqueId()
        },
        {
            label: checkLeftItem("home", i18n.t("Home")),
            onClick: () => { redirect(null, "index") },
            value: "home"
        },
        {
            label: checkLeftItem("bar-chart", i18n.t("Statistics")),
            onClick: () => { redirect(null, "stats") },
            value: "stats",
            permission: __.PERMISSION.STATS.VIEW
        },
        {
            label: checkLeftItem("users", i18n.t("Users")),
            onClick: () => { redirect(null, "users") },
            value: "users",
            permission: __.PERMISSION.USER.VIEW
        },
        {
            label: checkLeftItem("cog", i18n.t("Settings")),
            onClick: () => { redirect(null, "settings") },
            value: "settings",
            permission: __.PERMISSION.SETTINGS.VIEW
        },
        { 
            label: checkLeftItem("power-off text-danger", i18n.t("Sign-Out")), 
            onClick: signOut,
            value: _.uniqueId()
        }
    ]

    _.remove(items, item => {
        if (!item.permission) return false;
        return !checkPerm(item.permission);
    });

    return (
        <Empty align="align-items-start">
            <div className={ "Side-menu-parent d-sm-flex flex-column align-self-stretch " + checkLeftMenu() } style={{
                minWidth: __menu.store[leftMenu] ? "200px" : null
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
            <div className="align-self-stretch w-100 d-flex flex-column" style={{ 
                minWidth: "320px", 
                height: "100vh"
            }}>
                <Card>
                    <CardBody className="d-flex p-1 pb-2">
                        <div>
                            <Button 
                                color="light" 
                                size="sm"
                                className="rounded-0" 
                                onClick={() => {
                                    __menu.actions.toggleMenu(leftMenu);
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
                                    isOpen={!!toggleState[stateLang]} 
                                    toggle={toggle(stateLang)}>
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

                <ModalLeavePage i18n={i18n} />

                <div className="d-flex ml-2 mt-2" style={{ position: "absolute" }}>
                    <ClientInfo />
                </div>
              
                <div className="w-100 flex-column flex-fill flex-sm-row d-flex" style={{
                    height: "0vh",
                    overflow: "auto"
                }}>
                    {children}
                </div>
            </div>
        </Empty>
    )
});

const ModalLeavePage = observer(props => {
    const { i18n } = props;
    
    return <Modal isOpen={!!__redirect.store.stateAlertRedirect}>
        <ModalHeader>{i18n.t("Attention!")}</ModalHeader>
        <ModalBody>{i18n.t("Are you sure leave the page?")}</ModalBody>
        <ModalFooter>
            <Button 
                onClick={__redirect.actions.redirectFromAlert}
                color="warning">
                {i18n.t("Confirm")}
            </Button>
            <Button 
                onClick={__redirect.actions.hideRedirectAlert}
                color="light">
                {i18n.t("Cancel")}
            </Button>
        </ModalFooter>
    </Modal>
});

const Document = props => {
    const { children, empty } = props;

    return <div>
        <Progress height={3} />
        {
            empty ?
            <Empty {...props}>
                { children }
            </Empty> 
            :
            <Layout {...props}>
                {children}
            </Layout>
        }
        {
            CFG.env === "development" ?
            <DevTools /> : null
        }
    </div>
}

export default Document;