/**
 * @swagger
 * /users/register:
 *   post:
 *    tags: [Auth]
 *    summary: Register a new user
 *    requestBody:
 *      required: true
 *      content:
 *        multipart/form-data:
 *          schema:
 *            type: object
 *            properties:
 *              username:
 *               type: string
 *               format: string
 *               example: johndoe
 *              fullName:
 *               type: string
 *               format: string
 *               example: John Doe
 *              email:
 *               type: string
 *               format: email
 *              avatar:
 *               type: file
 *               format: file
 *              coverImage:
 *               type: file
 *               format: file
 *   responses:
 *      201:
 *        description: User registered successfully
 *        content:
 *          application/json:
 *            example:
 *              statusCode: 201
 *              data:
 *                id: 60d0fe4f5311236168a109ca
 *                username: johndoe
 *                fullName: John Doe
 *                email: johndoe@example.com
 *                watchHistory: []
 *                avatar:
 *                  url: https://example.com/avatar.jpg
 *                  public_id: avatar_public_id
 *                coverImage:
 *                  url: https://example.com/cover.jpg
 *                  public_id: cover_image_public_id
 *                createdAt: 2023-06-11T17:40:35.637Z
 *                updatedAt: 2023-06-11T17:40:35.637Z
 *                isVerified: false
 *              success: true
 *              message: User registered successfully
 *      400:
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               error:
 *                 message: "Bad Request"
 */
// login route
/**
 * @swagger
 * /users/login:
 *    post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required:
 *              - email
 *              - password
 *            properties:
 *              email:
 *                type: string
 *                example: johndoe@example.com
 *              password:
 *                type: string
 *                example: strongpassword123
 *     responses:
 *      200:
 *        description: User logged in successfully
 *        content:
 *          application/json:
 *            example:
 *              statusCode: 200
 *              data:
 *                user:
 *                   id: 60d0fe4f5311236168a109ca
 *                   username: johndoe
 *                   fullName: John Doe
 *                   email: johndoe@example.com
 *                   watchHistory: [videoId ,videoId]
 *                   avatar:
 *                     url: https://example.com/avatar.jpg
 *                     public_id: avatar_public_id
 *                   coverImage:
 *                     url: https://example.com/cover.jpg
 *                     public_id: cover_image_public_id
 *                   createdAt: 2023-06-11T17:40:35.637Z
 *                   updatedAt: 2023-06-11T17:40:35.637Z
 *                   isVerified: false
 *                tokens:
 *                 accessToken: access_token_here
 *                 refreshToken: refresh_token_here
 *              success: true
 *              message: User logged in successfully
 *      400:
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               error:
 *                 message: "Bad Request"
 */
// logout route
/**
 * @swagger
 * /users/logout:
 *    post:
 *     tags: [Auth]
 *     summary: Logout a user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *      200:
 *        description: User logged out successfully
 *        content:
 *          application/json:
 *            example:
 *              statusCode: 200
 *              success: true
 *              data: {}
 *              message: User logged out successfully
 *      401:
 *        description: Unauthorized
 *        content:
 *         application/json:
 *          example:
 *           statusCode: 401
 *           success: false
 *           message: Unauthorized access
 *      500:
 *        description: Internal Server Error
 *        content:
 *         application/json:
 *            example:
 *             statusCode: 500
 *             success: false
 *             message: Internal Server Error
 */
// refresh access token route
/**
 * @swagger
 * /users/refresh-token:
 *    post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required:
 *              - refreshToken
 *            properties:
 *              refreshToken:
 *                type: string
 *                example: refresh_token_here
 *     responses:
 *      200:
 *        description: Access token refreshed successfully
 *        content:
 *          application/json:
 *            example:
 *              statusCode: 200
 *              success: true
 *              data:
 *                 accessToken: access_token_here
 *                 refreshToken: refresh_token_here
 *              message: Access token refreshed
 *      400:
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               error:
 *                 message: "Bad Request"
 */
// forgot password route
/**
 * @swagger
 * /users/forgot-password:
 *    post:
 *     tags: [Auth]
 *     summary: Forgot password
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required:
 *              - email
 *            properties:
 *              email:
 *                type: string
 *                example: johndoe@example.com
 *     responses:
 *      200:
 *       description: Email sent successfully with
 *          reset password link
 *       content:
 *        application/json:
 *         example:
 *          statusCode: 200
 *          success: true
 *          data:
 *              resetToken: reset_token_here
 *          message: Email sent successfully with
 *                      reset password link
 *      400:
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               error:
 *                 message: "Bad Request"
 */
// reset password route
/**
 * @swagger
 * /users/reset-password:
 *    post:
 *     tags: [Auth]
 *     summary: Reset password
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required:
 *              - resetToken
 *              - newPassword
 *            properties:
 *              resetToken:
 *                type: string
 *                example: reset_token_here
 *              newPassword:
 *                type: string
 *                example: newpassword123
 *     responses:
 *      200:
 *       description: Password reset successfully
 *       content:
 *        application/json:
 *         example:
 *          statusCode: 200
 *          success: true
 *          data: {}
 *          message: Password reset successfully
 *      400:
 *         description: Bad Request
 *         content:
 *           application/json:
 *             example:
 *               error:
 *                 message: "Bad Request"
 */
