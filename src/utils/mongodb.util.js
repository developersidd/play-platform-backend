import { isValidObjectId, mongo } from "mongoose";

export const createMongoId = (id) => {
  if (isValidObjectId(id)) {
    return new mongo.ObjectId(id);
  }
};

