import { Component, inject } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private fb = inject(UntypedFormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loginForm: UntypedFormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  loading = false;
  error = '';

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
        if (role === 'Admin') this.router.navigate(['/admin']);
        else if (role === 'Owner') this.router.navigate(['/owner']);
        else if (role === 'User') this.router.navigate(['/user']);
        else this.router.navigate(['/unauthorized']);
      },
      error: () => {
        this.loading = false;
        this.error = 'Invalid email or password';
      },
    });
  }
}