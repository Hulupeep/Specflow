'use strict';
class ServiceError extends Error{constructor(code,status=400){super(code);this.code=code;this.status=status;}}
module.exports={ServiceError};
