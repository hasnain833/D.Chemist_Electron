/**
 * electron/services/authService.cjs
 * Port of C# AuthService.
 */
const bcrypt = require('bcryptjs');
const { getByUsername } = require('../db/repositories/userRepository.cjs');

const AuthService = {
    async login(username, password) {
        const user = await getByUsername(username);
        if (!user) {
            return { success: false, message: 'Invalid username or password' };
        }
        
        if (user.status !== 'Active') {
            return { success: false, message: 'User account is inactive or disabled' };
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return { success: false, message: 'Invalid username or password' };
        }

        // Return user without password
        const { password: _, ...safeUser } = user;
        return { success: true, user: safeUser };
    },

    async hashPassword(password) {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(password, salt);
    },

    async changePassword(userId, newPassword) {
        const UserRepo = require('../db/repositories/userRepository.cjs');
        const AuditRepo = require('../db/repositories/auditRepository.cjs');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        await UserRepo.updatePassword(userId, hashedPassword);
        await AuditRepo.log({
            userId,
            action: 'Security',
            details: 'Password changed successfully.'
        });
        
        return { success: true };
    }
};

module.exports = AuthService;

