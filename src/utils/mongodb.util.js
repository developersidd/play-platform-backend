import { isValidObjectId, mongo } from "mongoose";

// eslint-disable-next-line import/prefer-default-export
export const createMongoId = (id) => {
  if (isValidObjectId(id)) {
    return new mongo.ObjectId(id);
  }
};
