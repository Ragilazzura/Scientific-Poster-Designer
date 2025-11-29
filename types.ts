
export interface PosterTheme {
  backgroundColor: string;
  titleColor: string;
  headingColor: string;
  textColor: string;
  accentColor: string;
  headerColor: string;
  sectionBackgroundColor: string;
  sectionBodyColor: string;
}

export type VisualData =
  | {
      type: 'donutChart';
      items: {
        label: string;
        value: number;
        color: string;
      }[];
      caption?: string;
    }
  | {
      type: 'lineChart';
      labels: string[];
      datasets: {
        label: string;
        data: number[];
        color: string;
      }[];
      caption?: string;
    }
  | {
      type: 'barChart';
      labels: string[];
      datasets: {
        label: string;
        data: number[];
        color: string;
      }[];
      caption?: string;
    }
  | {
      type: 'image';
      url: string;
      caption: string;
      style: 'normal' | 'circular';
    }
  | {
      type: 'table';
      headers: string[];
      rows: string[][];
      caption?: string;
  };

export interface SectionDesign {
    icon?: string;
    customColor?: string; // Overrides theme.headingColor (Header color)
    customBackgroundColor?: string; // NEW: Overrides theme.sectionBackgroundColor (Body color)
    variant?: 'default' | 'minimal' | 'solid' | 'flat';
}

export interface PosterSection {
  title: string;
  content: string;
  column: '1' | '2' | '3';
  visuals?: VisualData[]; // Changed from single 'visual' to array 'visuals'
  visual?: VisualData; // Kept for legacy compatibility during parsing
  design?: SectionDesign;
}

export interface ContactInfo {
    email: string;
    phone: string;
    location: string;
    website: string;
    qrCodeUrl: string;
}

export interface PosterData {
  title: string;
  authors: string[];
  university: string;
  department: string;
  leftLogoUrl?: string;
  rightLogoUrl?: string;
  theme: PosterTheme;
  sections: PosterSection[];
  contactInfo: ContactInfo;
}