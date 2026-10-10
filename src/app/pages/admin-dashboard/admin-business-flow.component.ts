import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-admin-business-flow',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './admin-business-flow.component.html',
  styleUrls: ['./admin-business-flow.component.scss', './admin-page-theme.scss']
})
export class AdminBusinessFlowComponent {
  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/admin']);
  }
}
