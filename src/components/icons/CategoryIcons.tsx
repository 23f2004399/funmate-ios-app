import React from 'react';
import { Image, ImageStyle } from 'react-native';

const CATEGORY_IMAGES: Record<string, any> = {
  movies_tv:  require('../../assets/icons/categories/cat_movies_tv.webp'),
  music:      require('../../assets/icons/categories/cat_music.webp'),
  sports:     require('../../assets/icons/categories/cat_sports.webp'),
  food:       require('../../assets/icons/categories/cat_food.webp'),
  travel:     require('../../assets/icons/categories/cat_travel.webp'),
  hobbies:    require('../../assets/icons/categories/cat_hobbies.webp'),
  arts:       require('../../assets/icons/categories/cat_arts.webp'),
  lifestyle:  require('../../assets/icons/categories/cat_lifestyle.webp'),
  social:     require('../../assets/icons/categories/cat_social.webp'),
  tech:       require('../../assets/icons/categories/cat_tech.webp'),
};

interface Props {
  categoryId: string;
  size?: number;
  style?: ImageStyle;
}

const CategoryIcon: React.FC<Props> = ({ categoryId, size = 52, style }) => {
  const source = CATEGORY_IMAGES[categoryId];
  if (!source) return null;
  return (
    <Image
      source={source}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
};

export default CategoryIcon;

