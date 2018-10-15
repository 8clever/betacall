const i18n = { t: txt => txt };

module.exports.PREFIX_ADMIN = "/admin";
module.exports.COMPANY_NAME = "call4all"

module.exports.LANGS = {
    PT: "pt",
    RU: "ru",
    EN: "en"
}

module.exports.LANG_DEF = module.exports.LANGS.EN;

module.exports.PERMISSION = {
    USER: {
        EDIT: "user.edit",
        VIEW: "user.view"
    }
}

module.exports.ROLES = {
    ADMIN: i18n.t("admin"),
    OPERATOR: i18n.t("operator")
}

module.exports.ERROR = {
    SUBJECT: {
        UNAUTHORIZED: "Unauthorized"
    }
}

module.exports.ESSENCE = {
    EMAIL: "emails",
    USERS: "users",
	LINKS: "links"
};