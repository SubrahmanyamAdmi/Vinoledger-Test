import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './profile-settings.component.html',
  styleUrls: ['./profile-settings.component.scss']
})
export class ProfileSettingsComponent {
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  message = '';
  error = '';
  confirmationOpen = false;
  passwordDialogOpen = false;
  successDialogOpen = false;

  constructor(public auth: AuthService, private router: Router) {}

  async updatePassword() {
    this.message = '';
    this.error = '';

    if (this.newPassword.length < 6) {
      this.error = 'New password must be at least 6 characters.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = 'New password and confirmation do not match.';
      return;
    }

    try {
      await this.auth.updatePassword(this.currentPassword, this.newPassword);
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : '';
      this.error = code === 'auth/wrong-password' || code === 'auth/invalid-credential'
        ? 'Current password is incorrect.'
        : error instanceof Error ? error.message : 'Unable to update the password.';
      return;
    }

    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.message = 'Password updated successfully.';
    this.passwordDialogOpen = false;
    this.successDialogOpen = true;
  }

  openPasswordConfirmation() {
    this.message = '';
    this.error = '';
    this.confirmationOpen = true;
  }

  continueToPasswordUpdate() {
    this.confirmationOpen = false;
    this.passwordDialogOpen = true;
  }

  closeDialogs() {
    this.confirmationOpen = false;
    this.passwordDialogOpen = false;
    this.error = '';
  }

  closeSuccessDialog() {
    this.successDialogOpen = false;
    this.message = '';
  }

  get dashboardLabel(): string {
    const role = this.auth.currentUser()?.role;
    if (role === 'Admin') return 'Admin Dashboard';
    if (role === 'Owner') return 'Owner Dashboard';
    return 'Cashier Dashboard';
  }

  get accountLabel(): string {
    const role = this.auth.currentUser()?.role;
    if (role === 'Admin') return 'admin';
    if (role === 'Owner') return 'owner';
    return 'cashier';
  }

  goBack() {
    const role = this.auth.currentUser()?.role;
    if (role === 'Admin') {
      this.router.navigate(['/admin']);
      return;
    }
    if (role === 'Owner') {
      this.router.navigate(['/owner']);
      return;
    }
    this.router.navigate(['/cashier-home']);
  }

  logout() {
    this.auth.logout();
  }
}
