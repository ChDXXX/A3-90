// middleware/requireOwnerOrAdmin.js
// Allow if in Admin group OR resource owner matches request owner
module.exports = function requireOwnerOrAdmin(pickOwner) {
  // pickOwner: (req) => string  用来取“此请求操作对象应属谁”（如 req.jwt.email）
  return (req, res, next) => {
    const groups = req.jwt?.['cognito:groups'];
    const isAdmin = Array.isArray(groups) ? groups.includes('Admin') : groups === 'Admin';
    if (isAdmin) return next();

    const requestOwner = pickOwner?.(req);
    if (!requestOwner) return res.status(403).json({ error: 'forbidden', reason: 'NO_OWNER' });

    // 你的资源 owner 与 requestOwner 如何匹配，由路由里自行查询/判断
    // 这里先放过，由具体路由读取 DDB 后比对:
    req._requireOwnerCheck = requestOwner;
    next();
  };
};
