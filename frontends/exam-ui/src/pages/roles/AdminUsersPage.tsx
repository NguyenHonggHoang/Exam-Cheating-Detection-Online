/**
 * AdminUsersPage
 * 
 * Admin page for managing users.
 * Includes list, search, create, edit, reset password, and export.
 */

import { useState, useEffect, useCallback } from 'react';
import { usersApi, type User, type PaginatedUsers } from '@/api/users';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert, AlertDescription } from '@/ui/alert';
import { Badge } from '@/ui/badge';
import {
    Users,
    Search,
    Plus,
    Edit,
    Trash2,
    Key,
    Download,
    ChevronLeft,
    ChevronRight,
    Loader2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    X,
    Shield,
    GraduationCap,
    Eye,
} from 'lucide-react';

const ROLES = [
    { value: 'CANDIDATE', label: 'Sinh viên', icon: GraduationCap, color: 'bg-blue-100 text-blue-800' },
    { value: 'PROCTOR', label: 'Giám thị', icon: Eye, color: 'bg-green-100 text-green-800' },
    { value: 'ADMIN', label: 'Quản trị', icon: Shield, color: 'bg-purple-100 text-purple-800' },
];

export function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize] = useState(20);
    const [roleFilter, setRoleFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Form states
    const [createForm, setCreateForm] = useState<Omit<User, 'id' | 'enabled' | 'roles' | 'createdAt'> & { password: string; role: 'CANDIDATE' | 'PROCTOR' | 'ADMIN' }>({ username: '', email: '', password: '', role: 'CANDIDATE' });
    const [editForm, setEditForm] = useState({ enabled: true, role: 'CANDIDATE' as 'CANDIDATE' | 'PROCTOR' | 'ADMIN' });
    const [newPassword, setNewPassword] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Load users
    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let result: PaginatedUsers;

            if (searchQuery) {
                const searchResults = await usersApi.search(searchQuery, 50);
                result = {
                    content: searchResults,
                    totalElements: searchResults.length,
                    totalPages: 1,
                    size: searchResults.length,
                    number: 0,
                };
            } else {
                result = await usersApi.list({
                    page: currentPage,
                    size: pageSize,
                    role: roleFilter || undefined,
                });
            }

            setUsers(result.content);
            setTotalPages(result.totalPages);
            setTotalElements(result.totalElements);
        } catch (err) {
            console.error('Failed to load users:', err);
            setError('Không thể tải danh sách người dùng');
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, roleFilter, searchQuery]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    // Create user
    const handleCreate = async () => {
        setActionLoading(true);
        try {
            await usersApi.create(createForm);
            setSuccess('Tạo người dùng thành công!');
            setShowCreateModal(false);
            setCreateForm({ username: '', email: '', password: '', role: 'CANDIDATE' });
            loadUsers();
        } catch (err) {
            console.error('Failed to create user:', err);
            setError('Không thể tạo người dùng');
        } finally {
            setActionLoading(false);
        }
    };

    // Update user
    const handleUpdate = async () => {
        if (!selectedUser) return;
        setActionLoading(true);
        try {
            await usersApi.update(selectedUser.id, editForm);
            setSuccess('Cập nhật người dùng thành công!');
            setShowEditModal(false);
            loadUsers();
        } catch (err) {
            console.error('Failed to update user:', err);
            setError('Không thể cập nhật người dùng');
        } finally {
            setActionLoading(false);
        }
    };

    // Reset password
    const handleResetPassword = async () => {
        if (!selectedUser || !newPassword) return;
        setActionLoading(true);
        try {
            await usersApi.resetPassword(selectedUser.id, newPassword);
            setSuccess('Đặt lại mật khẩu thành công!');
            setShowResetPasswordModal(false);
            setNewPassword('');
        } catch (err) {
            console.error('Failed to reset password:', err);
            setError('Không thể đặt lại mật khẩu');
        } finally {
            setActionLoading(false);
        }
    };

    // Delete user
    const handleDelete = async () => {
        if (!selectedUser) return;
        setActionLoading(true);
        try {
            await usersApi.delete(selectedUser.id);
            setSuccess('Xóa người dùng thành công!');
            setShowDeleteConfirm(false);
            setSelectedUser(null);
            loadUsers();
        } catch (err) {
            console.error('Failed to delete user:', err);
            setError('Không thể xóa người dùng');
        } finally {
            setActionLoading(false);
        }
    };

    // Export users
    const handleExport = async () => {
        try {
            const blob = await usersApi.exportCsv(roleFilter || undefined);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            setSuccess('Xuất danh sách thành công!');
        } catch (err) {
            console.error('Failed to export users:', err);
            setError('Không thể xuất danh sách');
        }
    };

    // Open edit modal
    const openEditModal = (user: User) => {
        setSelectedUser(user);
        const role = user.roles.includes('ROLE_ADMIN') ? 'ADMIN'
            : user.roles.includes('ROLE_PROCTOR') ? 'PROCTOR'
                : 'CANDIDATE';
        setEditForm({ enabled: user.enabled, role });
        setShowEditModal(true);
    };

    // Get role badge
    const getRoleBadge = (roles: string[]) => {
        const role = ROLES.find(r => roles.includes(`ROLE_${r.value}`));
        if (!role) return null;
        const Icon = role.icon;
        return (
            <Badge className={role.color}>
                <Icon className="w-3 h-3 mr-1" />
                {role.label}
            </Badge>
        );
    };

    // Auto-hide success message
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    return (
        <div className="max-w-7xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-6 h-6" />
                        Quản Lý Người Dùng
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Tổng cộng: {totalElements} người dùng
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-2" />
                        Xuất CSV
                    </Button>
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Thêm Người Dùng
                    </Button>
                </div>
            </div>

            {/* Alerts */}
            {error && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>{error}</AlertDescription>
                    <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setError(null)}>
                        <X className="w-4 h-4" />
                    </Button>
                </Alert>
            )}
            {success && (
                <Alert className="mb-4 bg-green-50 border-green-200 text-green-800">
                    <CheckCircle className="w-4 h-4" />
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            {/* Filters */}
            <Card className="mb-6">
                <CardContent className="py-4">
                    <div className="flex gap-4 items-center">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm kiếm theo tên hoặc email..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <select
                            value={roleFilter}
                            onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(0); }}
                            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Tất cả vai trò</option>
                            {ROLES.map(role => (
                                <option key={role.value} value={role.value}>{role.label}</option>
                            ))}
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
                <CardContent className="p-0">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                                    Người dùng
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                                    Email
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                                    Vai trò
                                </th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                                    Trạng thái
                                </th>
                                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                                    Thao tác
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12">
                                        <Loader2 className="w-8 h-8 mx-auto animate-spin text-gray-400" />
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-gray-500">
                                        Không tìm thấy người dùng
                                    </td>
                                </tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{user.username}</div>
                                            <div className="text-xs text-gray-500">{user.id.substring(0, 8)}...</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{user.email}</td>
                                        <td className="px-6 py-4">{getRoleBadge(user.roles)}</td>
                                        <td className="px-6 py-4">
                                            {user.enabled ? (
                                                <span className="inline-flex items-center gap-1 text-green-600">
                                                    <CheckCircle className="w-4 h-4" />
                                                    Hoạt động
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-red-600">
                                                    <XCircle className="w-4 h-4" />
                                                    Vô hiệu
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openEditModal(user)}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => { setSelectedUser(user); setShowResetPasswordModal(true); }}
                                                >
                                                    <Key className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-red-600 hover:bg-red-50"
                                                    onClick={() => { setSelectedUser(user); setShowDeleteConfirm(true); }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t">
                            <div className="text-sm text-gray-500">
                                Trang {currentPage + 1} / {totalPages}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === 0}
                                    onClick={() => setCurrentPage(p => p - 1)}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage >= totalPages - 1}
                                    onClick={() => setCurrentPage(p => p + 1)}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>Thêm Người Dùng Mới</CardTitle>
                            <CardDescription>Nhập thông tin người dùng</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Tên đăng nhập</label>
                                <input
                                    type="text"
                                    value={createForm.username}
                                    onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
                                    className="w-full px-4 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input
                                    type="email"
                                    value={createForm.email}
                                    onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full px-4 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Mật khẩu</label>
                                <input
                                    type="password"
                                    value={createForm.password}
                                    onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                                    className="w-full px-4 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Vai trò</label>
                                <select
                                    value={createForm.role}
                                    onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as 'CANDIDATE' | 'PROCTOR' | 'ADMIN' }))}
                                    className="w-full px-4 py-2 border rounded-lg"
                                >
                                    {ROLES.map(role => (
                                        <option key={role.value} value={role.value}>{role.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-2 pt-4">
                                <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                                    Hủy
                                </Button>
                                <Button className="flex-1" onClick={handleCreate} disabled={actionLoading}>
                                    {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Tạo
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>Chỉnh Sửa Người Dùng</CardTitle>
                            <CardDescription>{selectedUser.username}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="editEnabled"
                                    checked={editForm.enabled}
                                    onChange={e => setEditForm(f => ({ ...f, enabled: e.target.checked }))}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="editEnabled">Tài khoản hoạt động</label>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Vai trò</label>
                                <select
                                    value={editForm.role}
                                    onChange={e => setEditForm(f => ({ ...f, role: e.target.value as 'CANDIDATE' | 'PROCTOR' | 'ADMIN' }))}
                                    className="w-full px-4 py-2 border rounded-lg"
                                >
                                    {ROLES.map(role => (
                                        <option key={role.value} value={role.value}>{role.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-2 pt-4">
                                <Button variant="outline" className="flex-1" onClick={() => setShowEditModal(false)}>
                                    Hủy
                                </Button>
                                <Button className="flex-1" onClick={handleUpdate} disabled={actionLoading}>
                                    {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Lưu
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetPasswordModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>Đặt Lại Mật Khẩu</CardTitle>
                            <CardDescription>{selectedUser.username}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Mật khẩu mới</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-2 border rounded-lg"
                                    placeholder="Nhập mật khẩu mới..."
                                />
                            </div>
                            <div className="flex gap-2 pt-4">
                                <Button variant="outline" className="flex-1" onClick={() => { setShowResetPasswordModal(false); setNewPassword(''); }}>
                                    Hủy
                                </Button>
                                <Button className="flex-1" onClick={handleResetPassword} disabled={actionLoading || !newPassword}>
                                    {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Đặt Lại
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {showDeleteConfirm && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle className="text-red-600">Xác Nhận Xóa</CardTitle>
                            <CardDescription>
                                Bạn có chắc muốn xóa người dùng <strong>{selectedUser.username}</strong>?
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Alert variant="destructive" className="mb-4">
                                <AlertTriangle className="w-4 h-4" />
                                <AlertDescription>
                                    Thao tác này không thể hoàn tác. Tất cả dữ liệu liên quan sẽ bị xóa.
                                </AlertDescription>
                            </Alert>
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
                                    Hủy
                                </Button>
                                <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={actionLoading}>
                                    {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Xóa
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

export default AdminUsersPage;
