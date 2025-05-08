import { Schema, model } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
  {
    video: {
      type: {
        url: {
          type: String,
          required: [true, "Video URL is required"],
        },
        public_id: {
          type: String,
          required: [true, "Video public ID is required"],
        },
      },
      required: [true, "Video is required"],
    },
    thumbnail: {
      type: {
        url: {
          type: String,
          required: [true, "Thumbnail URL is required"],
        },
        public_id: {
          type: String,
          required: [true, "Thumbnail public ID is required"],
        },
      },
      required: true,
    },

    title: {
      type: String,
      required: [true, "Title is required"],
    },

    description: {
      type: String,
      required: [true, "Description is required"],
    },
    duration: {
      type: String,
      required: [true, "Duration is required"],
    },
    views: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tags: {
      type: [String],
      required: [true, "Tags are required"],
    },
  },
  { timestamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate);

const Video = model("Video", videoSchema);
export default Video;

/* 

  -------- Aggregation Pipeline --------
  [
   {
    $match: {
      isActive: true
    }
  },
  {
    $count: 'activeUsers'
  } 
   {
    $group: {
       _id: null, -> group all in one with nothing
      _id: "$gender", // -> group by gender  
       averageAge: {
         $avg: "$age"
       }
      }
  } 
  {
    $group: {
      _id: "$favoriteFruit",
     count: { 
      $sum:  1 // that mean's if there are any user found on banana group then increase count by 1 
    	}
    }
  },
  {
    $sort: {
      count: -1
    }
  }
]
 -> find unique eyeColor and count how many times it appears
[
  {
    $group: {
      _id: "$eyeColor",
      colorCount: {
        $sum: 1
      }
    }
  },
  {
    $sort: {
      colorCount: -1
    }
  },
  {
    $limit: 1
  }
]

 -> Group user by country name and show highest population country

 [
  {
    $group: {
      _id: "$company.location.country",
      count: {
        $sum: 1,
      },
    },
  },
  {
    $sort: {
      count: -1,
    },
  },
  {
    $limit: 1,
  },
  }
]

-> what is the average number of tags per user?
 Solution 1 using $size -> 
 [
  {
    $group: {
      _id: null,
      averageTag: {
        $avg: {
          $size: "$tags"
        }
      }
    }
  }
]
  Solution 2 using $unwind -> 
  Definition : $unwind is a operator that will expand the array and create a new document for each element in the array with the same data as the original document.
  $unwind -> expands the array with $unwind operator
  [
  {
    $unwind: "$tags"
  },
  {
    $group: {
      _id: "$_id",
      numberOfTags: {
        $sum: 1
      }
    }
  },
  {
    $group: {
      _id: null,
      averageTag: {
        $avg: "$numberOfTags"
      }
    }
  }
]
 Solution 3 using $addFields ->
 $addFields -> The $addFields stage is a new stage in MongoDB 3.4 that allows you to add new fields to documents. if the field already exists then it will be overwritten.
  [
    {
      $addFields: {
        numberOfTags: {
          $size: {
            $ifNull: ["$tags", []]
          }
        }
      }
    },
    {
      $group: {
        _id: null,
        averageTag: {
          $avg: "$numberOfTags"
        }
      }
    }

  Qt: How many users have 'enim' as one of their tags?
  [
  {
    $match: {
      tags: "enim"
    }
  },
  {
    $count: "usersWithEnimTag"
  }

QT: What are the names and age of users who are inactive and have 'velit' as a tag?
 -> Definition of $project: 
 (Passes along the documents with the requested fields to the next stage in the pipeline. The specified fields can be existing fields from the input documents or newly computed fields.)
 this is used to select the fields that we want to show in the output
[
  {
    $match: {
      isActive: false,
      tags: "velit"
    }
  },
  {   
    $project: {
      name: 1,
      age: 1
    }
  }
]
  
  QT: How many users have a phone number starting with '+1 (940)'?
  [
  {
    $match: {
      "company.phone":  /^\+1 \(940\)/
    }
	},
  {
    $count: 'usersWithPhone'
  }
]

  QT: Who has registered the most recently?
  [
  {
    $sort: {
      registered: -1
    }
  },
  {
    $limit: 5
  }

  QT: Categorize users by their favorite fruit
  $push operator -> The $push operator appends a specified value to an array.
  [
  {
    $group: {
      _id: "$favoriteFruit",
      users: {
        $push: {
          name: "$name",
          age: "$age"
        
      } or like this -> 
      users: {
        $push: "$name"
      }

    }
  }
]

  QT: How many users have "ad" as the second tag in their list of tags?
  [
  {
    $match: {
      "tags.1": "ad"
    }
  },
  {
    $count: "usersWithAdAsSecondTag"
  }]

  Qt: Find users who have both "enim" and "id" as their tags
  $all operator -> The $all operator selects the documents where the value of a field is an array that contains all the specified elements.
  [
  {
    $match: {
      tags: {
        $all: ["enim", "id"]
      }
    }
  }
]

QT: List all companies located in USA with their corresponding user count.
[
  {
    $match: {
      "company.location.country": "USA"
    }
  },
  {
    $group: {
      _id: "$company.title",
      userCount: {
        $sum: 1
      }
    }
  }
]

$lookup -> The $lookup stage lets you add a new field as an array to a document by looking up matching documents in a separate collection.
 Create a field called author_details on books collection and set value from reading authors collection and then grab the first element from the author_details array and rewrite the author_details field with object.

  [
    {
      $lookup:{
        from: "authors",
        localField: "author_id",
        foreignField: "_id",
        as: "author_details"
      }
    },
    {
      $set: {
        author_details: {
          $arrayElemAt: ["$author_details", 0]
        }
      }
    }
    or like this ->
    {
      $set: {
        author_details: {
          $first: "$author_details"
        }
      }
    }
    or like this ->
    {
      $addFields: {
        author_details: {
          $arrayElemAt: ["$author_details", 0]
        }
      }
    }
  ]


*/
