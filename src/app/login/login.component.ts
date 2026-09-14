import { Component, inject } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private fb = inject(UntypedFormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  selectedRole: 'Admin' | 'Owner' | 'User' = 'Admin';

  loginForm: UntypedFormGroup = this.fb.group({
    email: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  loading = false;
  error = '';
  showPassword = false;

  roles = [
    { value: 'Admin', title: 'Administrator', subtitle: 'Manage customers, shops and users', icon: 'gear' },
    { value: 'Owner', title: 'Shop Owner', subtitle: 'View sales, stock and accounting', icon: 'building' },
    { value: 'User', title: 'Cashier', subtitle: 'Record daily sales and transactions', icon: 'cash' },
  ] as const;

  selectRole(role: 'Admin' | 'Owner' | 'User') {
    this.selectedRole = role;
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';

    const { email, password } = this.loginForm.value;

    this.auth.login({ email, password }).subscribe({
      next: () => {
        const role = this.auth.userRole() as UserRole | null;
            const expectedRole = this.selectedRole === 'User' ? 'User' : this.selectedRole;
            if (role !== expectedRole) {
              this.auth.logout();
              this.error = `These credentials belong to a ${role || 'different'} account. Select the matching role.`;
              this.loading = false;
              return;
            }
        if (role === 'Admin') this.router.navigate(['/admin']);
        else if (role === 'Owner') this.router.navigate(['/owner']);
        else if (role === 'User') this.router.navigate(['/cashier-home']);
        else this.router.navigate(['/unauthorized']);
      },
      error: () => {
        this.loading = false;
        this.error = 'Invalid email or password';
      },
    });
  }
}