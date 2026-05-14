module.exports = function (requiredRoles) {
    return function (req, res, next) {
        // req.user заповнюється твоїм попереднім auth middleware
        if (!req.user || !requiredRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Доступ заборонено: недостатньо прав' });
        }
        next();
    };
};