#Snapchain


##Features
Users visiting the site are prompted to upload a getUserMedia image, file uploads are not accepted.

If they reject they cannot see the site.

If they accept they can see the previous 30 images uploaded, as long as their image is in the last 30.


##Backend
Node with hapijs storing in mongo/mongoose using SSE for updates and having a restful api for uploads and image downloads, with anonymous auth

### API
* GET /images
    - JSON of image ids (requires auth)
* GET /images/updates
    - Some kind of SSE updated of images? starts out blank but then new images appear here if pushed from other clients?
* GET /image/{id}
    - JPG image file (requires auth)
* POST /images/new
    - JPG image file
* POST /login
    - some kind of json of system features? returns login session in cookie

##Frontend
React client logs in, posts images to api, gets images from api updates image list if new images seen via SSE

#Colors

DEBB76 - Peach
C07B6A - Red
617C8E - Blue
026666 - Cynan
0C559E - Attention Blue


##Plan

### Auth
User JWT2 and cookies,

###Server Sent events
[Example of using Hapi with SSEs][https://github.com/hapijs/hapi/issues/1008]

