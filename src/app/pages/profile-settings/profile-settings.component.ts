import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  updatePassword() {
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

    if (!this.auth.updatePassword(this.currentPassword, this.newPassword)) {
      this.error = 'Current password is incorrect.';
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

  goBack() {
    this.router.navigate(['/owner']);
  }

  logout() {
    this.auth.logout();
  }
}
