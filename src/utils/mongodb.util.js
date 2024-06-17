import { Types } from "mongoose";

export const createMongoId = (id) => new Types.ObjectId(id);
