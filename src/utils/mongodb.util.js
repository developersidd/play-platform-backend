import { mongo } from "mongoose";

export const createMongoId = (id) => new mongo.ObjectId(id);
