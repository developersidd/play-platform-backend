import { mongo } from "mongoose";

export const createMongoId = (id) => {
  if (id) {
    return new mongo.ObjectId(id);
  }
};
