import { Schema, model } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const subscriptionSchema = new Schema(
  {
    subscriber: {
      type: Schema.Types.ObjectId, // one who is subscribing
      ref: "User",
      required: true,
    },
    channel: {
      type: Schema.Types.ObjectId, // one to whom   'subscriber' is subscribing
      ref: "User",
      required: true,
    },
    isNotificationOn: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

subscriptionSchema.plugin(mongooseAggregatePaginate);

const Subscription = model("Subscription", subscriptionSchema);
export default Subscription;
