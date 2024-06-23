/**
 * @swagger
 * /videos:
 *   get:
 *     summary: Get a list of all videos
 *     tags: [Videos]
 *     security: []
 *     responses:
 *       200:
 *         description: Videos found
 *         content:
 *           application/json:
 *             example:
 *               '{"statusCode":200,"data":{"videos":[{"_id":"66688c13e1d8e0f223125e6c","video":{"url":"https://res.cloudinary.com/absiddik123/video/upload/v1718127633/youtube-clone/phtpco0tnjjqrdnd6k7b.mp4","public_id":"youtube-clone/phtpco0tnjjqrdnd6k7b","_id":"66688c13e1d8e0f223125e6d"},"thumbnail":{"url":"https://res.cloudinary.com/absiddik123/image/upload/v1718127634/youtube-clone/dn949g0jvavnohxvj663.png","public_id":"youtube-clone/dn949g0jvavnohxvj663","_id":"66688c13e1d8e0f223125e6e"},"title":"Hello","description":"Hello","duration":"2s","views":0,"isPublished":true,"owner":"660ee40206d8fcf5c713bdb6","createdAt":"2024-06-11T17:40:35.637Z","updatedAt":"2024-06-11T17:40:35.637Z","__v":0},{"_id":"66688047571b4d881d0ec217","video":{"url":"https://res.cloudinary.com/absiddik123/video/upload/","public_id":"youtube-clone/xlqnat7q32uqsr0fmpc6"},"thumbnail":{"url":"https://res.cloudinary.com/absiddik123/image/.png","public_id":"youtube-clone/swjoopcpympbs95oafxc"},"title":"Hello 1","description":"Hello","duration":"59s","views":0,"isPublished":true,"owner":"660ee40206d8fcf5c713bdb6","createdAt":"2024-06-11T16:50:15.391Z","updatedAt":"2024-06-11T16:50:15.391Z","__v":0}],"totalVideos":21,"totalPages":3,"currentPage":1,"hasNextPage":true,"hasPrevPage":false},"success":true,"message":"Videos found"}'
 *       400:
 *         description: Bad Request
 *         content:
 *          application/json:
 *            example:
 *             error:
 *              message: "Bad Request"
 */

// create a new video route
/**
 * @swagger
 * /videos:
 *   post:
 *     summary: Create a new video
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               videoFile:
 *                 type: string
 *                 format: binary
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Video created successfully
 *         content:
 *           application/json:
 *             example:
 *              '{"statusCode":201,"data":{"video":{"_id":"66688c13e1d8e0f223125e6c","video":{"url":"https://res.cloudinary.com/absiddik123/video/upload/v1718127633/youtube-clone/phtpco0tnjjqrdnd6k7b.mp4","public_id":"youtube-clone/phtpco0tnjjqrdnd6k7b","_id":"66688c13e1d8e0f223125e6d"},"thumbnail":{"url":"https://res.cloudinary.com/absiddik123/image/upload/v1718127634/youtube-clone/dn949g0jvavnohxvj663.png","public_id":"youtube-clone/dn949g0jvavnohxvj663","_id":"66688c13e1d8e0f223125e6e"},"title":"Hello","description":"Hello","duration":"2s","views":0,"isPublished":true,"owner":"660ee40206d8fcf5c713bdb6","createdAt":"2024-06-11T17:40:35.637Z","updatedAt":"2024-06-11T17:40:35.637Z","__v":0},"success":true,"message":"Video created"}'
 *
 *       400:
 *         description: Bad Request
 *         content:
 *          application/json:
 *            example:
 *             error:
 *              message: "Bad Request"
 */
