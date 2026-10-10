import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-contact-admin',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './contact-admin.component.html',
  styleUrls: ['./contact-admin.component.scss', '../admin-dashboard/admin-page-theme.scss']
})
export class ContactAdminComponent {
  constructor(public auth: AuthService, private router: Router) {}

  goBack() {
    this.router.navigate(['/owner']);
  }

  logout() {
    this.auth.logout();
  }
}
