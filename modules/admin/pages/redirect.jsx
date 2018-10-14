import { api, token, redirect } from "../utils/index.jsx";
import _ from "lodash";

export default async (ctx) => {
    let query = ctx.req.query;

    if (query.conversation) {
        let conv = await api("conversation._getConversations", token.get(ctx), {
            lookups: [
                {
                    from: "project",
                    localField: "_idproject",
                    foreignField: "_id",
                    as: "_t_project"
                }
            ],
            query: { _id: query.conversation }
        });
        let idProject = _.get(conv, "list.0._t_project.0.id");

        if (idProject) {
            redirect(ctx, `${idProject}/conversations`, { conv: query.conversation });
            return;
        }
    }

    if (query.idea) {
        let idea = await api("idea._getIdeas", token.get(ctx), {
            lookups: [
                {
                    from: "project",
                    localField: "_idproject",
                    foreignField: "_id",
                    as: "_t_project"
                }
            ],
            query: { id: query.idea }
        });
        let idProject = _.get(idea, "list.0._t_project.0.id");
        if (idProject) {
            redirect(ctx, `${idProject}/ideas`, { idea: query.idea });
            return;
        }
    }

    throw new Error(404);
}