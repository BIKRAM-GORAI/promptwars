export const errorHandler = (err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack || err.message || err);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  res.status(statusCode).json({
    message: err.message || 'An unexpected server error occurred',
    // Never expose stack trace in production environments
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};

export default errorHandler;
